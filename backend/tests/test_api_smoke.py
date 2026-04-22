"""Lightweight API smoke test — exercises register + login against a live Mongo.

Skipped automatically when MONGO_URI is unreachable, so `pytest` passes in
environments without Docker running.
"""

import os
import pytest
from fastapi.testclient import TestClient


def _mongo_reachable() -> bool:
    try:
        from pymongo import MongoClient
        from app.config import settings
        MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=500).server_info()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _mongo_reachable(), reason="Mongo not reachable")


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data and "mongo" in data


def test_register_login_flow(client):
    phone = "9000000001"
    client.post("/api/auth/register", json={
        "full_name": "Test Farmer",
        "phone": phone,
        "password": "secret123",
        "state": "Maharashtra",
        "district": "Pune",
        "annual_income": 180000,
    })

    r = client.post(
        "/api/auth/login",
        data={"username": phone, "password": "secret123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_apply_requires_jwt(client):
    r = client.post("/api/applications/", json={})
    assert r.status_code == 401
