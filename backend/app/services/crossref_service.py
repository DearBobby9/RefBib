"""CrossRef API client for BibTeX lookup by DOI or title search."""

import logging
from urllib.parse import quote

import httpx

from app.config import settings
from app.models.reference import ParsedReference
from app.utils.rate_limiter import TokenBucketRateLimiter
from app.utils.text_similarity import title_similarity

logger = logging.getLogger(__name__)

_DOI_BIBTEX_URL = "https://api.crossref.org/works/{doi}/transform/application/x-bibtex"
_SEARCH_URL = "https://api.crossref.org/works"

_DOI_TIMEOUT = 5.0  # seconds
_SEARCH_TIMEOUT = 10.0  # seconds


class CrossRefService:
    """Fetch BibTeX from CrossRef by DOI (primary) or title search (fallback).

    Args:
        client: Shared ``httpx.AsyncClient`` for making HTTP requests.
        rate_limiter: Token bucket rate limiter to respect CrossRef rate limits.
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        rate_limiter: TokenBucketRateLimiter,
    ) -> None:
        self.client = client
        self.rate_limiter = rate_limiter

    async def lookup(
        self, ref: ParsedReference
    ) -> tuple[str, float] | None:
        """Try to find BibTeX for *ref*.

        Strategy:
            1. If a DOI exists, fetch BibTeX directly (confidence 1.0).
            2. Otherwise search by title and return the best fuzzy match.

        Returns:
            ``(bibtex_string, confidence)`` or ``None`` if nothing matched.
        """
        # --- 1. DOI-based lookup (high confidence) ---
        if ref.doi:
            bibtex = await self._lookup_by_doi(ref.doi)
            if bibtex:
                logger.info(
                    "[CrossRefService] DOI lookup succeeded for doi=%s",
                    ref.doi,
                )
                return (bibtex, 1.0)
            logger.warning(
                "[CrossRefService] DOI lookup failed for doi=%s, falling back to title search",
                ref.doi,
            )

        # --- 2. Title-based search ---
        if ref.title:
            result = await self._search_by_title(ref.title)
            if result:
                bibtex, confidence = result
                logger.info(
                    "[CrossRefService] Title search matched with confidence=%.3f for title='%s'",
                    confidence,
                    ref.title[:80],
                )
                return (bibtex, confidence)

        logger.debug(
            "[CrossRefService] No match found for ref index=%d", ref.index
        )
        return None

    async def _lookup_by_doi(self, doi: str) -> str | None:
        """Fetch BibTeX directly from CrossRef using a DOI."""
        url = _DOI_BIBTEX_URL.format(doi=quote(doi, safe=""))
        try:
            await self.rate_limiter.acquire()
            response = await self.client.get(
                url,
                headers={"Accept": "application/x-bibtex"},
                timeout=_DOI_TIMEOUT,
            )
            response.raise_for_status()
            bibtex = response.text.strip()
            if bibtex and bibtex.startswith("@"):
                return bibtex
            logger.warning(
                "[CrossRefService] DOI response was not valid BibTeX for doi=%s",
                doi,
            )
            return None
        except httpx.TimeoutException:
            logger.warning(
                "[CrossRefService] Timeout fetching BibTeX by DOI=%s", doi
            )
            return None
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[CrossRefService] HTTP %d for DOI=%s", exc.response.status_code, doi
            )
            return None
        except httpx.HTTPError as exc:
            logger.error(
                "[CrossRefService] HTTP error for DOI=%s: %s", doi, exc
            )
            return None

    async def _search_by_title(
        self, title: str
    ) -> tuple[str, float] | None:
        """Search CrossRef by bibliographic query and return the best matching BibTeX."""
        params: dict[str, str | int] = {
            "query.bibliographic": title,
            "rows": 3,
        }
        if settings.crossref_mailto:
            params["mailto"] = settings.crossref_mailto

        try:
            await self.rate_limiter.acquire()
            response = await self.client.get(
                _SEARCH_URL, params=params, timeout=_SEARCH_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            logger.warning(
                "[CrossRefService] Timeout searching title='%s'", title[:80]
            )
            return None
        except httpx.HTTPError as exc:
            logger.error(
                "[CrossRefService] HTTP error searching title='%s': %s",
                title[:80],
                exc,
            )
            return None
        except Exception as exc:
            logger.error(
                "[CrossRefService] Unexpected error parsing search response: %s", exc
            )
            return None

        items = data.get("message", {}).get("items", [])
        if not items:
            return None

        # Find best title match
        best_score: float = 0.0
        best_doi: str | None = None

        for item in items:
            item_titles = item.get("title", [])
            if not item_titles:
                continue
            item_title = item_titles[0]
            score = title_similarity(title, item_title)

            if score > best_score:
                best_score = score
                best_doi = item.get("DOI")

        # Check if best match meets the threshold
        if best_score < settings.fuzzy_match_threshold or not best_doi:
            logger.debug(
                "[CrossRefService] Best title match score=%.3f below threshold=%.2f",
                best_score,
                settings.fuzzy_match_threshold,
            )
            return None

        # Fetch BibTeX for the best matching DOI
        bibtex = await self._lookup_by_doi(best_doi)
        if bibtex:
            return (bibtex, best_score)

        return None
