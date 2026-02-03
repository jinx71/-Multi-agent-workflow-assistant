"""LangGraph graph construction.

The graph is a linear pipeline with one feedback loop:

    START -> researcher -> summarizer -> critic --(approve)--> finalizer -> END
                               ^                  |
                               +----(revise)------+

The conditional edge out of ``critic`` is what makes this a *reflection* loop
rather than a one-shot chain: the critic can send the draft back to the
summarizer to be improved, bounded by ``max_revisions`` so it always terminates.
"""

from typing import Literal

from langgraph.graph import END, START, StateGraph

from app.agents.nodes import (
    critic_node,
    finalizer_node,
    researcher_node,
    summarizer_node,
)
from app.agents.state import WorkflowState
from app.config import get_settings


def route_after_critic(state: WorkflowState) -> Literal["revise", "finalize"]:
    """Decide whether to revise again or finalize.

    We finalize when the critic approves *or* when we've hit the revision cap
    (first draft + ``max_revisions`` revisions). The cap guarantees termination
    even if the critic would keep asking for changes forever.
    """
    max_iterations = get_settings().max_revisions + 1
    if state.get("verdict") == "approve":
        return "finalize"
    if state.get("iteration", 1) >= max_iterations:
        return "finalize"
    return "revise"


def build_graph():
    """Build and compile the workflow graph."""
    builder = StateGraph(WorkflowState)

    builder.add_node("researcher", researcher_node)
    builder.add_node("summarizer", summarizer_node)
    builder.add_node("critic", critic_node)
    builder.add_node("finalizer", finalizer_node)

    builder.add_edge(START, "researcher")
    builder.add_edge("researcher", "summarizer")
    builder.add_edge("summarizer", "critic")
    builder.add_conditional_edges(
        "critic",
        route_after_critic,
        {"revise": "summarizer", "finalize": "finalizer"},
    )
    builder.add_edge("finalizer", END)

    return builder.compile()


# Compiled once at import time and reused for every request.
graph = build_graph()
