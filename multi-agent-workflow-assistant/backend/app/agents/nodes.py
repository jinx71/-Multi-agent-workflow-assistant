"""Agent node implementations.

Each function is a node in the LangGraph graph. It receives the shared
``WorkflowState``, does its work, and returns a dict of the keys it wants to
write back. Nodes emit fine-grained progress with ``get_stream_writer()`` so the
UI can show what each agent is doing in real time.
"""

import asyncio
import logging
from typing import Literal

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.config import get_stream_writer
from pydantic import BaseModel, Field

from app.agents.prompts import (
    CRITIC_PROMPT,
    FINALIZER_PROMPT,
    RESEARCHER_PROMPT,
    SUMMARIZER_PROMPT,
)
from app.agents.state import WorkflowState
from app.agents.tools import run_web_search, to_sources, web_search
from app.config import get_settings

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def make_model(model_name: str, *, temperature: float = 0.3, **kwargs) -> ChatGroq:
    """Build a Groq chat model. The API key is read from the environment
    (``GROQ_API_KEY``).

    Groq exposes an OpenAI-compatible API, so the same ``bind_tools`` /
    ``with_structured_output`` / streaming calls the nodes already use work
    unchanged.
    """
    settings = get_settings()
    return ChatGroq(
        model=model_name,
        temperature=temperature,
        max_retries=2,
        timeout=settings.request_timeout_seconds,
        **kwargs,
    )


def _safe_writer():
    """Return the stream writer, or a no-op if we're not in a streaming context.

    This lets the same nodes run under both ``graph.astream`` (streaming) and
    ``graph.ainvoke`` (the non-streaming endpoint and tests) without changes.
    """
    try:
        return get_stream_writer()
    except Exception:  # noqa: BLE001
        return lambda *_args, **_kwargs: None


def _as_text(content) -> str:
    """Coerce an LLM message's ``content`` (str or list of blocks) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


# --------------------------------------------------------------------------- #
# Critic structured-output schema
# --------------------------------------------------------------------------- #
class Critique(BaseModel):
    """Forced structured output from the Critic.

    Constraining the critic to this schema makes routing deterministic: the
    graph branches on ``verdict`` instead of trying to parse free-form prose.
    """

    assessment: str = Field(description="A short overall assessment of the draft.")
    issues: list[str] = Field(
        default_factory=list,
        description="Concrete, actionable problems to fix. Empty when approving.",
    )
    verdict: Literal["approve", "revise"] = Field(
        description="'approve' if publication-ready, otherwise 'revise'."
    )


# --------------------------------------------------------------------------- #
# Nodes
# --------------------------------------------------------------------------- #
async def researcher_node(state: WorkflowState) -> dict:
    """Gather information using a hand-rolled tool-calling loop.

    The loop is explicit (rather than a prebuilt ReAct agent) so every search
    decision is visible: the model proposes a query, we run it, feed results
    back, and repeat up to ``max_research_tool_calls`` rounds before forcing a
    synthesis pass.
    """
    writer = _safe_writer()
    settings = get_settings()
    topic = state["topic"]
    writer({"type": "progress", "node": "researcher", "message": f"Planning research on \u201c{topic}\u201d"})

    model = make_model(settings.researcher_model, temperature=0.4).bind_tools([web_search])
    messages: list = [
        SystemMessage(content=RESEARCHER_PROMPT),
        HumanMessage(content=f"Topic to research:\n\n{topic}"),
    ]
    all_results: list[dict] = []
    ai = None

    for _ in range(settings.max_research_tool_calls):
        ai = await model.ainvoke(messages)
        messages.append(ai)
        if not ai.tool_calls:
            break
        for call in ai.tool_calls:
            query = str(call["args"].get("query", "")).strip()
            writer({"type": "progress", "node": "researcher", "message": f"Searching: {query}"})
            results = await asyncio.to_thread(run_web_search, query)
            all_results.extend(results)
            writer(
                {
                    "type": "progress",
                    "node": "researcher",
                    "message": f"Found {len(results)} source(s) for \u201c{query}\u201d",
                }
            )
            if results:
                content = "\n\n".join(
                    f"[{r['title']}]({r['url']})\n{r['content']}" for r in results
                )
            else:
                content = "No external results. Use your own knowledge and flag uncertainty."
            messages.append(ToolMessage(content=content[:6000], tool_call_id=call["id"]))
    else:
        # Ran out of tool budget without a final answer — force synthesis.
        writer({"type": "progress", "node": "researcher", "message": "Compiling research notes"})
        messages.append(
            HumanMessage(content="Stop searching now and compile your findings into concise research notes.")
        )
        ai = await make_model(settings.researcher_model).ainvoke(messages)

    notes = _as_text(ai.content) if ai else ""
    sources = to_sources(all_results)
    writer(
        {
            "type": "progress",
            "node": "researcher",
            "message": f"Research complete \u00b7 {len(sources)} unique source(s)",
        }
    )
    return {"research": notes, "sources": sources}


async def summarizer_node(state: WorkflowState) -> dict:
    """Write (or revise) the report from the research notes."""
    writer = _safe_writer()
    settings = get_settings()
    iteration = state.get("iteration", 0) + 1
    revising = bool(state.get("critique"))
    writer(
        {
            "type": "progress",
            "node": "summarizer",
            "message": f"Revising draft (pass {iteration})" if revising else "Writing first draft",
        }
    )

    parts = [
        f"Topic:\n{state['topic']}",
        f"Research notes:\n{state.get('research', '')}",
    ]
    if revising:
        parts.append(f"Your previous draft:\n{state.get('draft', '')}")
        issues = "\n".join(f"- {i}" for i in state.get("issues", []))
        parts.append(
            f"Editor's assessment:\n{state.get('critique', '')}\n\nIssues to fix:\n{issues}"
        )
    human = "\n\n---\n\n".join(parts)

    model = make_model(settings.summarizer_model)
    ai = await model.ainvoke([SystemMessage(content=SUMMARIZER_PROMPT), HumanMessage(content=human)])
    return {"draft": _as_text(ai.content), "iteration": iteration}


async def critic_node(state: WorkflowState) -> dict:
    """Review the draft and emit a structured verdict that drives routing."""
    writer = _safe_writer()
    settings = get_settings()
    writer({"type": "progress", "node": "critic", "message": "Reviewing draft for accuracy and gaps"})

    human = "\n\n---\n\n".join(
        [
            f"Topic:\n{state['topic']}",
            f"Research notes:\n{state.get('research', '')}",
            f"Draft to review:\n{state.get('draft', '')}",
        ]
    )
    model = make_model(settings.critic_model, temperature=0).with_structured_output(Critique)
    result: Critique = await model.ainvoke(
        [SystemMessage(content=CRITIC_PROMPT), HumanMessage(content=human)]
    )
    writer({"type": "progress", "node": "critic", "message": f"Verdict: {result.verdict}"})
    return {"verdict": result.verdict, "critique": result.assessment, "issues": result.issues}


async def finalizer_node(state: WorkflowState) -> dict:
    """Polish the approved draft into the final report.

    This node's LLM call streams token-by-token to the client via LangGraph's
    ``messages`` stream mode, so the final report appears live as it is written.
    """
    writer = _safe_writer()
    settings = get_settings()
    writer({"type": "progress", "node": "finalizer", "message": "Polishing the final report"})

    human = "\n\n---\n\n".join(
        [
            f"Topic:\n{state['topic']}",
            f"Approved report to finalize:\n{state.get('draft', '')}",
        ]
    )
    model = make_model(settings.summarizer_model)
    ai = await model.ainvoke([SystemMessage(content=FINALIZER_PROMPT), HumanMessage(content=human)])
    return {"final_report": _as_text(ai.content)}
