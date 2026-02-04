"""Shared workflow state.

This ``TypedDict`` is the single contract that every agent node reads from and
writes to. LangGraph merges each node's returned dict into this state by
*overwriting* the keys it returns, so the graph stays easy to reason about:
you can tell exactly what each node touches by looking at its return value.
"""

from typing import TypedDict


class Source(TypedDict):
    title: str
    url: str


class WorkflowState(TypedDict, total=False):
    # Input
    topic: str

    # Produced by the researcher
    research: str            # synthesised research notes (markdown)
    sources: list[Source]    # de-duplicated citations gathered from search

    # Produced by the summarizer (rewritten on each revision pass)
    draft: str
    iteration: int           # how many times the summarizer has run

    # Produced by the critic
    verdict: str             # "approve" | "revise"
    critique: str            # human-readable assessment
    issues: list[str]        # concrete, actionable problems to fix

    # Produced by the finalizer
    final_report: str

    # Error channel
    error: str
