"""Availability discovery service for unresolved references."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from urllib.parse import quote

import httpx

from app.config import settings
from app.models.api import (
    DiscoveryReferenceInput,
    DiscoveryResult,
    DiscoverySource,
    DiscoveryStatus,
)
from app.utils.rate_limiter import TokenBucketRateLimiter
from app.utils.text_similarity import title_similarity

logger = logging.getLogger(__name__)

_CROSSREF_WORKS_URL = "https://api.crossref.org/works"
_S2_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
_DBLP_SEARCH_URL = "https://dblp.org/search/publ/api"

_TIMEOUT = 10.0


class DiscoveryService:
    """Probe indexed sources to determine if a reference is discoverable."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        crossref_rate_limiter: TokenBucketRateLimiter,
        semantic_scholar_rate_limiter: TokenBucketRateLimiter,
        dblp_rate_limiter: TokenBucketRateLimiter,
    ) -> None:
        self.client = client
        self.crossref_rate_limiter = crossref_rate_limiter
        self.semantic_scholar_rate_limiter = semantic_scholar_rate_limiter
        self.dblp_rate_limiter = dblp_rate_limiter
        self.semaphore = asyncio.Semaphore(settings.max_concurrent_lookups)

    async def check_all(self, refs: list[DiscoveryReferenceInput]) -> list[DiscoveryResult]:
        tasks = [self._check_one(ref) for ref in refs]
        return await asyncio.gather(*tasks)

    async def _check_one(self, ref: DiscoveryReferenceInput) -> DiscoveryResult:
        if not ref.title:
            return DiscoveryResult(
                index=ref.index,
                discovery_status=DiscoveryStatus.SKIPPED,
                reason="Missing title; cannot run discovery search.",
            )

        async with self.semaphore:
            checks: list[
                tuple[
                    DiscoverySource,
                    Callable[[DiscoveryReferenceInput], Awaitable[tuple[float, str | None] | None]],
                ]
            ] = [
                (DiscoverySource.CROSSREF, self._check_crossref),
                (DiscoverySource.SEMANTIC_SCHOLAR, self._check_semantic_scholar),
                (DiscoverySource.DBLP, self._check_dblp),
            ]

            available_on: list[DiscoverySource] = []
            best_confidence: float | None = None
            best_url: str | None = None
            error_sources: list[DiscoverySource] = []

            for source, checker in checks:
                try:
                    result = await checker(ref)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "[DiscoveryService] %s check failed for ref #%d: %s",
                        source.value,
                        ref.index,
                        exc,
                    )
                    error_sources.append(source)
                    continue

                if result is None:
                    continue

                confidence, url = result
                available_on.append(source)
                if best_confidence is None or confidence > best_confidence:
                    best_confidence = confidence
                    best_url = url

            if available_on:
                return DiscoveryResult(
                    index=ref.index,
                    discovery_status=DiscoveryStatus.AVAILABLE,
                    available_on=available_on,
                    best_confidence=best_confidence,
                    best_url=best_url,
                )

            if len(error_sources) == len(checks):
                return DiscoveryResult(
                    index=ref.index,
                    discovery_status=DiscoveryStatus.ERROR,
                    reason="All indexed sources failed. Please retry.",
                )

            return DiscoveryResult(
                index=ref.index,
                discovery_status=DiscoveryStatus.UNAVAILABLE,
                reason="Not found in indexed sources.",
            )

    async def _check_crossref(
        self, ref: DiscoveryReferenceInput
    ) -> tuple[float, str | None] | None:
        if ref.doi:
            await self.crossref_rate_limiter.acquire()
            response = await self.client.get(
                f"{_CROSSREF_WORKS_URL}/{quote(ref.doi, safe='')}",
                timeout=_TIMEOUT,
            )
            response.raise_for_status()
            message = response.json().get("message", {})
            url = message.get("URL") or f"https://doi.org/{ref.doi}"
            return (1.0, url)

        if not ref.title:
            return None

        await self.crossref_rate_limiter.acquire()
        response = await self.client.get(
            _CROSSREF_WORKS_URL,
            params={"query.bibliographic": ref.title, "rows": 3},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        items = response.json().get("message", {}).get("items", [])

        best_score = 0.0
        best_url: str | None = None
        for item in items:
            titles = item.get("title", [])
            if not titles:
                continue
            score = title_similarity(ref.title, titles[0])
            if score > best_score:
                best_score = score
                best_url = item.get("URL")
                doi = item.get("DOI")
                if not best_url and isinstance(doi, str) and doi.strip():
                    best_url = f"https://doi.org/{doi.strip()}"

        if best_score >= settings.fuzzy_match_threshold:
            return (best_score, best_url)
        return None

    async def _check_semantic_scholar(
        self, ref: DiscoveryReferenceInput
    ) -> tuple[float, str | None] | None:
        if not ref.title:
            return None

        await self.semantic_scholar_rate_limiter.acquire()
        response = await self.client.get(
            _S2_SEARCH_URL,
            params={
                "query": ref.title,
                "limit": 3,
                "fields": "title,url,externalIds,authors,year,venue",
            },
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        papers = response.json().get("data", [])

        best_score = 0.0
        best_url: str | None = None
        for paper in papers:
            paper_title = paper.get("title")
            if not paper_title:
                continue
            score = title_similarity(ref.title, paper_title)
            if score <= best_score:
                continue
            paper_url = paper.get("url")
            if not paper_url:
                external_ids = paper.get("externalIds")
                if isinstance(external_ids, dict):
                    doi = external_ids.get("DOI") or external_ids.get("doi")
                    if isinstance(doi, str) and doi.strip():
                        paper_url = f"https://doi.org/{doi.strip()}"
            best_score = score
            best_url = paper_url

        if best_score >= settings.fuzzy_match_threshold:
            return (best_score, best_url)
        return None

    async def _check_dblp(
        self, ref: DiscoveryReferenceInput
    ) -> tuple[float, str | None] | None:
        if not ref.title:
            return None

        await self.dblp_rate_limiter.acquire()
        response = await self.client.get(
            _DBLP_SEARCH_URL,
            params={"q": ref.title, "format": "json", "h": 3},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        hits = response.json().get("result", {}).get("hits", {}).get("hit", [])
        if isinstance(hits, dict):
            hits = [hits]

        best_score = 0.0
        best_url: str | None = None
        for hit in hits:
            info = hit.get("info", {})
            hit_title = str(info.get("title", "")).rstrip(".")
            if not hit_title:
                continue
            score = title_similarity(ref.title, hit_title)
            if score > best_score:
                best_score = score
                best_url = info.get("url")

        if best_score >= settings.fuzzy_match_threshold:
            return (best_score, best_url)
        return None
