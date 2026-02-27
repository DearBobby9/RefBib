"""Tests for discovery status classification logic."""

import pytest
from unittest.mock import AsyncMock

from app.models.api import DiscoveryReferenceInput, DiscoveryStatus
from app.services.discovery_service import DiscoveryService


# --- Input validation tests ---


def test_discovery_ref_strips_invalid_doi():
    ref = DiscoveryReferenceInput(index=1, doi="not-a-doi")
    assert ref.doi is None


def test_discovery_ref_accepts_valid_doi():
    ref = DiscoveryReferenceInput(index=1, doi="10.1234/some.path")
    assert ref.doi == "10.1234/some.path"


def test_discovery_ref_truncates_long_title():
    long_title = "A" * 600
    ref = DiscoveryReferenceInput(index=1, title=long_title)
    assert len(ref.title) == 500


def test_discovery_ref_normalizes_empty_doi_to_none():
    ref = DiscoveryReferenceInput(index=1, doi="  ")
    assert ref.doi is None


class _NoopRateLimiter:
    async def acquire(self) -> None:
        return None


def _service() -> DiscoveryService:
    client = AsyncMock()
    limiter = _NoopRateLimiter()
    return DiscoveryService(client, limiter, limiter, limiter)


def _ref(index: int, title: str | None) -> DiscoveryReferenceInput:
    return DiscoveryReferenceInput(
        index=index,
        raw_citation=f"raw-{index}",
        title=title,
        authors=["Author, A."],
        year=2024,
        doi=None,
        venue=None,
    )


@pytest.mark.asyncio
async def test_check_one_returns_skipped_when_title_missing():
    service = _service()

    result = await service._check_one(_ref(1, None))

    assert result.discovery_status == DiscoveryStatus.SKIPPED
    assert result.reason


@pytest.mark.asyncio
async def test_check_one_marks_available_and_uses_best_confidence():
    service = _service()
    service._check_crossref = AsyncMock(return_value=(0.72, "https://crossref"))
    service._check_semantic_scholar = AsyncMock(return_value=(0.95, "https://s2"))
    service._check_dblp = AsyncMock(return_value=None)

    result = await service._check_one(_ref(2, "A title"))

    assert result.discovery_status == DiscoveryStatus.AVAILABLE
    assert [source.value for source in result.available_on] == [
        "crossref",
        "semantic_scholar",
    ]
    assert result.best_confidence == 0.95
    assert result.best_url == "https://s2"


@pytest.mark.asyncio
async def test_check_one_marks_unavailable_when_no_source_matches():
    service = _service()
    service._check_crossref = AsyncMock(return_value=None)
    service._check_semantic_scholar = AsyncMock(return_value=None)
    service._check_dblp = AsyncMock(return_value=None)

    result = await service._check_one(_ref(3, "No match title"))

    assert result.discovery_status == DiscoveryStatus.UNAVAILABLE
    assert result.available_on == []


@pytest.mark.asyncio
async def test_check_one_marks_error_when_all_sources_fail():
    service = _service()
    service._check_crossref = AsyncMock(side_effect=RuntimeError("crossref down"))
    service._check_semantic_scholar = AsyncMock(side_effect=RuntimeError("s2 down"))
    service._check_dblp = AsyncMock(side_effect=RuntimeError("dblp down"))

    result = await service._check_one(_ref(4, "Error title"))

    assert result.discovery_status == DiscoveryStatus.ERROR
    assert result.reason
