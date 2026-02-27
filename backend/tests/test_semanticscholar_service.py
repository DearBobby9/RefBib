"""Tests for Semantic Scholar service lookup_with_doi and backward compatibility."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.models.reference import ParsedReference
from app.services.semanticscholar_service import SemanticScholarService
from app.utils.rate_limiter import TokenBucketRateLimiter


def _make_service(client: AsyncMock | None = None) -> SemanticScholarService:
    return SemanticScholarService(
        client=client or AsyncMock(),
        rate_limiter=TokenBucketRateLimiter(100.0),
    )


def _parsed_ref(title: str = "Attention Is All You Need") -> ParsedReference:
    return ParsedReference(
        index=1,
        raw_citation="raw",
        title=title,
        authors=["Vaswani, A."],
        year=2017,
    )


def _s2_response(
    title: str = "Attention Is All You Need",
    doi: str | None = "10.1234/test",
    bibtex: str | None = "@article{vaswani2017,\n  title={Attention}\n}",
) -> dict:
    paper = {
        "title": title,
        "url": "https://api.semanticscholar.org/paper/123",
        "year": 2017,
        "authors": [{"name": "Ashish Vaswani"}],
        "venue": "NeurIPS",
        "externalIds": {},
    }
    if doi:
        paper["externalIds"]["DOI"] = doi
    if bibtex:
        paper["citationStyles"] = {"bibtex": bibtex}
    else:
        paper["citationStyles"] = None
    return {"data": [paper]}


def test_lookup_with_doi_returns_bibtex_and_doi():
    """When S2 has both BibTeX and DOI, lookup_with_doi returns both."""
    service = _make_service()

    async def _mock_get(url, **kwargs):
        return SimpleNamespace(
            status_code=200,
            json=lambda: _s2_response(),
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    bibtex_result, doi = asyncio.run(service.lookup_with_doi(_parsed_ref()))
    assert bibtex_result is not None
    bibtex, score, url = bibtex_result
    assert bibtex.startswith("@article{")
    assert score > 0.9
    assert doi == "10.1234/test"


def test_lookup_with_doi_returns_doi_without_bibtex():
    """When S2 has DOI but no BibTeX, return DOI with None bibtex result."""
    service = _make_service()

    async def _mock_get(url, **kwargs):
        return SimpleNamespace(
            status_code=200,
            json=lambda: _s2_response(bibtex=None),
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    bibtex_result, doi = asyncio.run(service.lookup_with_doi(_parsed_ref()))
    assert bibtex_result is None
    assert doi == "10.1234/test"


def test_lookup_with_doi_returns_none_none_on_no_match():
    """When S2 returns no results, both values are None."""
    service = _make_service()

    async def _mock_get(url, **kwargs):
        return SimpleNamespace(
            status_code=200,
            json=lambda: {"data": []},
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    bibtex_result, doi = asyncio.run(service.lookup_with_doi(_parsed_ref()))
    assert bibtex_result is None
    assert doi is None


def test_lookup_unchanged_backward_compat():
    """The original lookup() method still returns (bibtex, score, url) or None."""
    service = _make_service()

    async def _mock_get(url, **kwargs):
        return SimpleNamespace(
            status_code=200,
            json=lambda: _s2_response(),
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    result = asyncio.run(service.lookup(_parsed_ref()))
    assert result is not None
    bibtex, score, url = result
    assert bibtex.startswith("@article{")
    assert score > 0.9


def test_lookup_returns_none_when_no_bibtex():
    """lookup() returns None when S2 has no BibTeX (even if DOI exists)."""
    service = _make_service()

    async def _mock_get(url, **kwargs):
        return SimpleNamespace(
            status_code=200,
            json=lambda: _s2_response(bibtex=None),
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    result = asyncio.run(service.lookup(_parsed_ref()))
    assert result is None
