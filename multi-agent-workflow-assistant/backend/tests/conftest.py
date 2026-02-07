"""Shared test fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """A TestClient that runs the app's lifespan (startup/shutdown)."""
    with TestClient(app) as test_client:
        yield test_client
