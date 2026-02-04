"""FastAPI application entry point.

Exposes:
- ``GET  /health``               liveness probe
- ``GET  /api/config``           non-secret runtime config for the UI
- ``POST /api/workflow``         run the workflow, return the final report (JSON)
- ``POST /api/workflow/stream``  run the workflow, stream every agent step (SSE)
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import __version__
from app.config import get_settings
from app.schemas import ApiResponse, ConfigResponse, WorkflowRequest
from app.services.runner import run_workflow, workflow_event_stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Export credentials from settings into the environment on startup.

    LangChain's Groq integration reads ``GROQ_API_KEY`` (and Tavily reads
    ``TAVILY_API_KEY``) from the environment, so we surface them here from our
    validated settings.
    """
    settings = get_settings()
    if settings.groq_api_key:
        os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
    if settings.tavily_api_key:
        os.environ.setdefault("TAVILY_API_KEY", settings.tavily_api_key)
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY is not set — workflow runs will fail until it is configured.")
    yield


app = FastAPI(
    title="Multi-Agent Workflow Assistant",
    description="A Researcher -> Summarizer -> Critic reflection loop orchestrated with LangGraph.",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/api/config", response_model=ConfigResponse)
async def config() -> ConfigResponse:
    settings = get_settings()
    return ConfigResponse(
        researcher_model=settings.researcher_model,
        summarizer_model=settings.summarizer_model,
        critic_model=settings.critic_model,
        max_revisions=settings.max_revisions,
        search_enabled=settings.search_enabled,
    )


def _require_api_key() -> None:
    if not get_settings().groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured on the server.",
        )


@app.post("/api/workflow", response_model=ApiResponse)
async def run(request: WorkflowRequest) -> ApiResponse:
    """Run the workflow to completion and return the final report."""
    _require_api_key()
    try:
        result = await run_workflow(request.topic)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Workflow failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ApiResponse(
        success=True,
        data={
            "topic": result.get("topic"),
            "final_report": result.get("final_report", ""),
            "sources": result.get("sources", []),
            "iterations": result.get("iteration"),
        },
        message="Workflow completed.",
    )


@app.post("/api/workflow/stream")
async def run_stream(request: WorkflowRequest) -> StreamingResponse:
    """Run the workflow and stream every agent step as Server-Sent Events."""
    _require_api_key()
    return StreamingResponse(
        workflow_event_stream(request.topic),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering so events flush live
        },
    )
