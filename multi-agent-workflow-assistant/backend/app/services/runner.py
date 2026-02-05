"""Run the workflow and translate LangGraph's stream into frontend events.

The streaming endpoint consumes three of LangGraph's stream modes at once and
folds them into a single, simple event protocol the browser understands:

- ``updates``  -> a node finished; emit a ``node_complete`` event with its output
- ``custom``   -> in-node progress; emit a ``progress`` event
- ``messages`` -> token-by-token output; forwarded only for the finalizer node
                  so the final report streams in live

Every event is a JSON object on a single SSE ``data:`` line.
"""

import json
import logging
from collections.abc import AsyncIterator

from app.agents.graph import graph

logger = logging.getLogger(__name__)


def _sse(payload: dict) -> str:
    """Format a dict as one SSE event."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _chunk_text(message_chunk) -> str:
    """Extract plain text from a streamed message chunk (str or block list)."""
    content = getattr(message_chunk, "content", "")
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
    return ""


def _node_complete_event(node: str, delta: dict) -> dict:
    """Build a tailored ``node_complete`` event for a finished node."""
    event = {"event": "node_complete", "node": node}
    if node == "researcher":
        event["sources"] = delta.get("sources", [])
        event["research"] = delta.get("research", "")
    elif node == "summarizer":
        event["draft"] = delta.get("draft", "")
        event["iteration"] = delta.get("iteration")
    elif node == "critic":
        event["verdict"] = delta.get("verdict")
        event["critique"] = delta.get("critique", "")
        event["issues"] = delta.get("issues", [])
    elif node == "finalizer":
        event["final_report"] = delta.get("final_report", "")
    return event


async def workflow_event_stream(topic: str) -> AsyncIterator[str]:
    """Yield SSE strings for the full agent run."""
    initial: dict = {"topic": topic, "iteration": 0}
    yield _sse({"event": "start", "topic": topic})

    try:
        async for mode, chunk in graph.astream(
            initial, stream_mode=["updates", "custom", "messages"]
        ):
            if mode == "custom":
                # chunk is the dict passed to the stream writer inside a node
                yield _sse({"event": "progress", **chunk})

            elif mode == "updates":
                # chunk is {node_name: state_delta}
                for node, delta in chunk.items():
                    if isinstance(delta, dict):
                        yield _sse(_node_complete_event(node, delta))

            elif mode == "messages":
                # chunk is (message_chunk, metadata)
                message_chunk, metadata = chunk
                if metadata.get("langgraph_node") == "finalizer":
                    text = _chunk_text(message_chunk)
                    if text:
                        yield _sse({"event": "token", "text": text})

        yield _sse({"event": "done"})

    except Exception as exc:  # noqa: BLE001 - surface failures to the client cleanly
        logger.exception("Workflow run failed")
        yield _sse({"event": "error", "message": str(exc)})


async def run_workflow(topic: str) -> dict:
    """Run the workflow to completion and return the final state (no streaming)."""
    return await graph.ainvoke({"topic": topic, "iteration": 0})
