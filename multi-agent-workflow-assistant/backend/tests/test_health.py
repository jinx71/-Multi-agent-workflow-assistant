"""Tests for the health and config endpoints (no API key required)."""


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_config_shape(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {
        "researcher_model",
        "summarizer_model",
        "critic_model",
        "max_revisions",
        "search_enabled",
    }
    assert isinstance(body["search_enabled"], bool)
    assert isinstance(body["max_revisions"], int)
