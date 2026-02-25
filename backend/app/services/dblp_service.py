"""DBLP API client for BibTeX lookup by title search."""

import logging

import httpx

from app.config import settings
from app.models.reference import ParsedReference
from app.utils.rate_limiter import TokenBucketRateLimiter
from app.utils.text_similarity import title_similarity

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://dblp.org/search/publ/api"
_BIBTEX_URL = "https://dblp.org/rec/{key}.bib"

_SEARCH_TIMEOUT = 10.0  # seconds
_BIBTEX_TIMEOUT = 5.0  # seconds


class DBLPService:
    """Search DBLP by title and fetch BibTeX for the best match.

    Args:
        client: Shared ``httpx.AsyncClient`` for making HTTP requests.
        rate_limiter: Token bucket rate limiter to respect DBLP rate limits.
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
        """Search DBLP by title, then fetch BibTeX for the best matching record.

        Returns:
            ``(bibtex_string, confidence)`` or ``None`` if no match found.
        """
        if not ref.title:
            logger.debug(
                "[DBLPService] Skipping ref index=%d, no title", ref.index
            )
            return None

        # Step 1: Search DBLP for publications matching the title
        hits = await self._search(ref.title)
        if not hits:
            return None

        # Step 2: Find best title match
        best_hit = None
        best_score: float = 0.0

        for hit in hits:
            info = hit.get("info", {})
            hit_title = info.get("title", "")
            # DBLP titles sometimes end with a period; strip it for comparison
            hit_title = hit_title.rstrip(".")

            score = title_similarity(ref.title, hit_title)
            if score > best_score:
                best_score = score
                best_hit = hit

        if best_score < settings.fuzzy_match_threshold or not best_hit:
            logger.debug(
                "[DBLPService] Best match score=%.3f below threshold=%.2f for title='%s'",
                best_score,
                settings.fuzzy_match_threshold,
                ref.title[:80],
            )
            return None

        # Step 3: Extract record key and fetch BibTeX
        info = best_hit.get("info", {})
        rec_url = info.get("url", "")
        rec_key = self._extract_key(rec_url)
        if not rec_key:
            logger.warning(
                "[DBLPService] Could not extract record key from url='%s'",
                rec_url,
            )
            return None

        bibtex = await self._fetch_bibtex(rec_key)
        if bibtex:
            logger.info(
                "[DBLPService] Matched with confidence=%.3f for title='%s'",
                best_score,
                ref.title[:80],
            )
            return (bibtex, best_score)

        return None

    async def _search(self, title: str) -> list[dict]:
        """Query the DBLP search API and return the list of hit objects."""
        try:
            await self.rate_limiter.acquire()
            response = await self.client.get(
                _SEARCH_URL,
                params={"q": title, "format": "json", "h": 3},
                timeout=_SEARCH_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            logger.warning(
                "[DBLPService] Timeout searching title='%s'", title[:80]
            )
            return []
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[DBLPService] HTTP %d searching title='%s'",
                exc.response.status_code,
                title[:80],
            )
            return []
        except httpx.HTTPError as exc:
            logger.error(
                "[DBLPService] HTTP error searching title='%s': %s",
                title[:80],
                exc,
            )
            return []
        except Exception as exc:
            logger.error(
                "[DBLPService] Unexpected error parsing search response: %s",
                exc,
            )
            return []

        # Navigate the DBLP JSON response structure
        result = data.get("result", {})
        hits_wrapper = result.get("hits", {})
        hits = hits_wrapper.get("hit", [])

        # DBLP returns a single dict (not a list) when there is exactly one hit
        if isinstance(hits, dict):
            hits = [hits]

        return hits

    @staticmethod
    def _extract_key(dblp_url: str) -> str | None:
        """Extract the DBLP record key from a URL.

        Example:
            ``https://dblp.org/rec/conf/nips/VaswaniSPUJGKP17``
            -> ``conf/nips/VaswaniSPUJGKP17``
        """
        marker = "dblp.org/rec/"
        idx = dblp_url.find(marker)
        if idx == -1:
            return None
        key = dblp_url[idx + len(marker) :]
        # Strip any trailing slashes or query params
        key = key.split("?")[0].rstrip("/")
        return key if key else None

    async def _fetch_bibtex(self, key: str) -> str | None:
        """Download the BibTeX entry for a DBLP record key."""
        url = _BIBTEX_URL.format(key=key)
        try:
            await self.rate_limiter.acquire()
            response = await self.client.get(url, timeout=_BIBTEX_TIMEOUT)
            response.raise_for_status()
            bibtex = response.text.strip()
            if bibtex and bibtex.startswith("@"):
                return bibtex
            logger.warning(
                "[DBLPService] Response for key=%s was not valid BibTeX", key
            )
            return None
        except httpx.TimeoutException:
            logger.warning(
                "[DBLPService] Timeout fetching BibTeX for key=%s", key
            )
            return None
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[DBLPService] HTTP %d fetching BibTeX for key=%s",
                exc.response.status_code,
                key,
            )
            return None
        except httpx.HTTPError as exc:
            logger.error(
                "[DBLPService] HTTP error fetching BibTeX for key=%s: %s",
                key,
                exc,
            )
            return None
