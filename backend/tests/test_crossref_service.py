"""Tests for CrossRef service JSON fallback and metadata fetching."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.models.reference import ParsedReference
from app.services.crossref_service import CrossRefService
from app.utils.rate_limiter import TokenBucketRateLimiter


def _make_service(client: AsyncMock | None = None) -> CrossRefService:
    return CrossRefService(
        client=client or AsyncMock(),
        rate_limiter=TokenBucketRateLimiter(100.0),
    )


def _parsed_ref(
    title: str = "Attention Is All You Need",
    doi: str | None = None,
) -> ParsedReference:
    return ParsedReference(
        index=1,
        raw_citation="raw",
        title=title,
        authors=["Vaswani, A."],
        year=2017,
        doi=doi,
    )


def _crossref_item(
    title: str = "Attention Is All You Need",
    doi: str = "10.1234/test",
    item_type: str = "journal-article",
) -> dict:
    return {
        "title": [title],
        "DOI": doi,
        "URL": f"https://doi.org/{doi}",
        "type": item_type,
        "author": [{"family": "Vaswani", "given": "Ashish"}],
        "published": {"date-parts": [[2017]]},
        "container-title": ["NeurIPS"],
    }


def test_search_falls_back_to_json_when_transform_fails():
    """When title search finds a DOI but /transform fails, fall back to JSON construction."""
    service = _make_service()
    ref = _parsed_ref()
    item = _crossref_item()

    # Search succeeds
    search_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"message": {"items": [item]}},
        raise_for_status=lambda: None,
    )
    # /transform (DOI lookup) fails
    transform_response = SimpleNamespace(
        status_code=404,
        text="Not found",
    )

    def _raise_404():
        import httpx

        raise httpx.HTTPStatusError(
            "404", request=httpx.Request("GET", "http://x"), response=httpx.Response(404)
        )

    transform_response.raise_for_status = _raise_404

    call_count = 0

    async def _mock_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if "query.bibliographic" in str(kwargs.get("params", {})):
            return search_response
        return transform_response

    service.client.get = _mock_get

    result = asyncio.run(service._search_by_title(ref.title))
    assert result is not None
    bibtex, confidence, url = result
    assert bibtex.startswith("@article{")
    assert confidence <= 0.85
    assert "Attention Is All You Need" in bibtex


def test_doi_lookup_falls_back_to_json_when_transform_fails():
    """When DOI exists but /transform fails, fall back to JSON metadata construction."""
    service = _make_service()
    ref = _parsed_ref(doi="10.1234/test")
    item = _crossref_item(doi="10.1234/test")

    import httpx

    call_count = 0

    async def _mock_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if "transform" in str(url):
            raise httpx.HTTPStatusError(
                "404",
                request=httpx.Request("GET", url),
                response=httpx.Response(404),
            )
        # /works/{doi} JSON endpoint
        return SimpleNamespace(
            status_code=200,
            json=lambda: {"message": item},
            raise_for_status=lambda: None,
        )

    service.client.get = _mock_get

    result = asyncio.run(service.lookup(ref))
    assert result is not None
    bibtex, confidence, url = result
    assert bibtex.startswith("@article{")
    assert confidence == 0.95
    assert "10.1234/test" in url


def test_transform_preferred_over_json_when_both_succeed():
    """When /transform returns valid BibTeX, JSON fallback is not used."""
    service = _make_service()
    ref = _parsed_ref(doi="10.1234/test")

    async def _mock_get(url, **kwargs):
        if "transform" in str(url):
            return SimpleNamespace(
                status_code=200,
                text="@article{vaswani2017,\n  title={Attention}\n}",
                raise_for_status=lambda: None,
            )
        # Should not reach JSON endpoint
        raise AssertionError("JSON endpoint should not be called")

    service.client.get = _mock_get

    result = asyncio.run(service.lookup(ref))
    assert result is not None
    bibtex, confidence, url = result
    assert confidence == 1.0
    assert bibtex.startswith("@article{vaswani2017,")


def test_fetch_work_metadata_timeout_returns_none():
    """When /works/{doi} times out, _fetch_work_metadata returns None."""
    import httpx

    service = _make_service()

    async def _mock_get(url, **kwargs):
        raise httpx.TimeoutException("timed out")

    service.client.get = _mock_get

    result = asyncio.run(service._fetch_work_metadata("10.1234/test"))
    assert result is None
