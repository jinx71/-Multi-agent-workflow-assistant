"""Tests for the workflow endpoints.

The happy paths mock the runner so no real Groq call is made; the error
paths exercise validation and the missing-key guard.
"""

from app import main
from app.config import get_settings


def test_topic_validation_rejects_short_input(client):
    response = client.post("/api/workflow", json={"topic": "a"})
    assert response.status_code == 422


def test_workflow_requires_api_key(client):
    # No GROQ_API_KEY configured by default -> 503.
    response = client.post("/api/workflow", json={"topic": "quantum error correction"})
    assert response.status_code == 503


def test_workflow_success_when_mocked(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "groq_api_key", "test-key", raising=False)

    async def fake_run_workflow(topic: str):
        return {
            "topic": topic,
            "final_report": "# Report\n\nAll done.",
            "sources": [{"title": "Source", "url": "https://example.com"}],
            "iteration": 1,
        }

    monkeypatch.setattr(main, "run_workflow", fake_run_workflow)

    response = client.post("/api/workflow", json={"topic": "quantum error correction"})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["final_report"].startswith("# Report")
    assert body["data"]["sources"][0]["url"] == "https://example.com"


def test_stream_emits_sse_events_when_mocked(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "groq_api_key", "test-key", raising=False)

    async def fake_stream(topic: str):
        yield 'data: {"event": "start"}\n\n'
        yield 'data: {"event": "node_complete", "node": "researcher", "sources": []}\n\n'
        yield 'data: {"event": "done"}\n\n'

    monkeypatch.setattr(main, "workflow_event_stream", fake_stream)

    response = client.post("/api/workflow/stream", json={"topic": "quantum error correction"})
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert '"event": "start"' in response.text
    assert '"event": "done"' in response.text
