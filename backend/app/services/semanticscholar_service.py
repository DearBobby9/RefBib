"""Semantic Scholar API client for BibTeX lookup by title search."""

import logging

import httpx

from app.config import settings
from app.models.reference import ParsedReference
from app.utils.rate_limiter import TokenBucketRateLimiter
from app.utils.text_similarity import title_similarity

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
_SEARCH_FIELDS = "title,citationStyles,externalIds,year,authors,venue"
_SEARCH_TIMEOUT = 10.0  # seconds


class SemanticScholarService:
    """Search Semantic Scholar by title and return BibTeX if available.

    Args:
        client: Shared ``httpx.AsyncClient`` for making HTTP requests.
        rate_limiter: Token bucket rate limiter to respect S2 rate limits.
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
        """Search Semantic Scholar by title.

        Returns:
            ``(bibtex_string, confidence)`` or ``None`` if no match with BibTeX.
        """
        if not ref.title:
            logger.debug(
                "[SemanticScholarService] Skipping ref index=%d, no title",
                ref.index,
            )
            return None

        try:
            await self.rate_limiter.acquire()
            response = await self.client.get(
                _SEARCH_URL,
                params={
                    "query": ref.title,
                    "limit": 3,
                    "fields": _SEARCH_FIELDS,
                },
                timeout=_SEARCH_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            logger.warning(
                "[SemanticScholarService] Timeout searching title='%s'",
                ref.title[:80],
            )
            return None
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[SemanticScholarService] HTTP %d searching title='%s'",
                exc.response.status_code,
                ref.title[:80],
            )
            return None
        except httpx.HTTPError as exc:
            logger.error(
                "[SemanticScholarService] HTTP error searching title='%s': %s",
                ref.title[:80],
                exc,
            )
            return None
        except Exception as exc:
            logger.error(
                "[SemanticScholarService] Unexpected error parsing response: %s",
                exc,
            )
            return None

        papers = data.get("data", [])
        if not papers:
            logger.debug(
                "[SemanticScholarService] No results for title='%s'",
                ref.title[:80],
            )
            return None

        # Find best title match that has citationStyles.bibtex
        best_bibtex: str | None = None
        best_score: float = 0.0

        for paper in papers:
            paper_title = paper.get("title")
            if not paper_title:
                continue

            score = title_similarity(ref.title, paper_title)

            if score <= best_score:
                continue

            # Check if citationStyles.bibtex is available
            citation_styles = paper.get("citationStyles")
            if not citation_styles:
                continue
            bibtex = citation_styles.get("bibtex")
            if not bibtex:
                continue

            best_score = score
            best_bibtex = bibtex.strip()

        if best_score < settings.fuzzy_match_threshold or not best_bibtex:
            logger.debug(
                "[SemanticScholarService] Best match score=%.3f below threshold=%.2f for title='%s'",
                best_score,
                settings.fuzzy_match_threshold,
                ref.title[:80],
            )
            return None

        logger.info(
            "[SemanticScholarService] Matched with confidence=%.3f for title='%s'",
            best_score,
            ref.title[:80],
        )
        return (best_bibtex, best_score)
