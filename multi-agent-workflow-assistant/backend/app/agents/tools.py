"""Tools the Researcher agent can call.

The single tool here is a web search backed by Tavily (free tier). It degrades
gracefully: with no ``TAVILY_API_KEY`` the tool returns an empty result set and
the Researcher falls back to its own knowledge, so the app still runs end-to-end
with only a Groq API key.

The tool is split into two pieces on purpose:
- ``web_search`` — a LangChain ``@tool`` whose *schema* is bound to the model so
  the LLM knows how to call it.
- ``run_web_search`` — the plain function we execute ourselves inside the
  Researcher's tool loop. Hand-rolling the loop (instead of hiding it behind a
  prebuilt agent) keeps every step visible and explainable.
"""

import logging

from langchain_core.tools import tool

from app.agents.state import Source
from app.config import get_settings

logger = logging.getLogger(__name__)


def run_web_search(query: str) -> list[dict]:
    """Execute a web search and return a list of {title, url, content} dicts.

    Returns an empty list if Tavily is not configured or the call fails — the
    caller is responsible for handling the no-results case.
    """
    settings = get_settings()
    if not settings.tavily_api_key:
        logger.info("TAVILY_API_KEY not set; skipping live search for: %s", query)
        return []

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.tavily_api_key)
        response = client.search(
            query=query,
            max_results=settings.search_results_per_query,
            search_depth="basic",
        )
        return [
            {
                "title": item.get("title", "Untitled"),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
            }
            for item in response.get("results", [])
        ]
    except Exception as exc:  # noqa: BLE001 - never let a tool failure crash a node
        logger.warning("Web search failed for %r: %s", query, exc)
        return []


@tool
def web_search(query: str) -> str:
    """Search the web for current information about a query.

    Use this to gather facts, figures, and recent developments. Pass a single,
    focused search query.
    """
    results = run_web_search(query)
    if not results:
        return "No external search results available. Rely on your own knowledge and flag uncertainty."
    return "\n\n".join(
        f"[{r['title']}]({r['url']})\n{r['content']}" for r in results
    )


def to_sources(results: list[dict]) -> list[Source]:
    """Project raw search results down to the citation fields the UI displays."""
    seen: set[str] = set()
    sources: list[Source] = []
    for r in results:
        url = r.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        sources.append({"title": r.get("title", "Untitled"), "url": url})
    return sources
