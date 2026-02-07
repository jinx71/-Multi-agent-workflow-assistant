"""Tests for graph structure and the critic routing logic.

These verify the reflection loop's control flow without any LLM calls.
"""

from app.agents.graph import build_graph, route_after_critic


def test_router_finalizes_on_approve():
    assert route_after_critic({"verdict": "approve", "iteration": 1}) == "finalize"


def test_router_revises_under_cap():
    # Default max_revisions=2 -> max_iterations=3; iteration 1 is under the cap.
    assert route_after_critic({"verdict": "revise", "iteration": 1}) == "revise"


def test_router_finalizes_at_cap():
    # iteration 3 has hit the cap -> stop revising even if the critic wants more.
    assert route_after_critic({"verdict": "revise", "iteration": 3}) == "finalize"


def test_router_defaults_are_safe():
    # Missing verdict/iteration should never loop forever.
    assert route_after_critic({}) in {"revise", "finalize"}


def test_graph_contains_all_agents():
    graph = build_graph()
    node_names = set(graph.get_graph().nodes)
    assert {"researcher", "summarizer", "critic", "finalizer"}.issubset(node_names)
