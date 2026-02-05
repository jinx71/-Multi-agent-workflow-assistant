"""Request and response models for the HTTP API."""

from typing import Any

from pydantic import BaseModel, Field


class WorkflowRequest(BaseModel):
    topic: str = Field(
        min_length=3,
        max_length=500,
        description="The topic or question for the agents to research and report on.",
    )


class ApiResponse(BaseModel):
    """Standard response envelope used across the API."""

    success: bool
    data: Any | None = None
    message: str = ""


class ConfigResponse(BaseModel):
    researcher_model: str
    summarizer_model: str
    critic_model: str
    max_revisions: int
    search_enabled: bool
