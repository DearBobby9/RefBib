"""Tests for /api/discovery/check router behavior."""

from fastapi.testclient import TestClient

from app.main import app
from app.models.api import DiscoveryResult, DiscoveryStatus
from app.services.discovery_service import DiscoveryService


def _payload(size: int, max_items: int = 20) -> dict:
    references = []
    for index in range(1, size + 1):
        references.append(
            {
                "index": index,
                "raw_citation": f"raw-{index}",
                "title": f"title-{index}",
                "authors": ["Author, A."],
                "year": 2024,
                "doi": None,
                "venue": None,
            }
        )
    return {"references": references, "max_items": max_items}


def test_discovery_rejects_request_when_reference_count_exceeds_max_items():
    with TestClient(app) as client:
        response = client.post("/api/discovery/check", json=_payload(size=2, max_items=1))

    assert response.status_code == 400
    assert "Too many references" in response.json()["detail"]


def test_discovery_rejects_max_items_above_limit():
    with TestClient(app) as client:
        response = client.post("/api/discovery/check", json=_payload(size=1, max_items=21))

    assert response.status_code == 400
    assert "max_items cannot exceed" in response.json()["detail"]


def test_discovery_returns_results(monkeypatch):
    async def fake_check_all(self, refs):  # noqa: ANN001, ANN202
        return [
            DiscoveryResult(
                index=ref.index,
                discovery_status=DiscoveryStatus.AVAILABLE,
                available_on=[],
                best_confidence=0.91,
                best_url="https://example.com/paper",
                reason=None,
            )
            for ref in refs
        ]

    monkeypatch.setattr(DiscoveryService, "check_all", fake_check_all)

    with TestClient(app) as client:
        response = client.post("/api/discovery/check", json=_payload(size=2))

    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 2
    assert body["results"][0]["discovery_status"] == "available"
    assert body["results"][0]["best_confidence"] == 0.91
