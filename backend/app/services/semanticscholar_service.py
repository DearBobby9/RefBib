"""Semantic Scholar API client for BibTeX lookup by title search."""

import logging

import httpx

from app.config import settings
from app.models.reference import ParsedReference
from app.utils.rate_limiter import TokenBucketRateLimiter
from app.utils.text_similarity import title_similarity

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
_SEARCH_FIELDS = "title,citationStyles,externalIds,url,year,authors,venue"
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
    ) -> tuple[str, float, str | None] | None:
        """Search Semantic Scholar by title.

        Returns:
            ``(bibtex_string, confidence, url)`` or ``None`` if no match with BibTeX.
        """
        result = await self._search_papers(ref)
        if result is None:
            return None
        bibtex, score, url, _doi = result
        if bibtex:
            return (bibtex, score, url)
        return None

    async def lookup_with_doi(
        self, ref: ParsedReference
    ) -> tuple[tuple[str, float, str | None] | None, str | None]:
        """Search Semantic Scholar by title, returning both BibTeX and DOI info.

        Returns:
            A 2-tuple of:
            - ``(bibtex, confidence, url)`` or ``None`` if no BibTeX found
            - DOI string or ``None`` if no DOI found
        """
        result = await self._search_papers(ref)
        if result is None:
            return (None, None)
        bibtex, score, url, doi = result
        bibtex_result = (bibtex, score, url) if bibtex else None
        return (bibtex_result, doi)

    async def _search_papers(
        self, ref: ParsedReference
    ) -> tuple[str | None, float, str | None, str | None] | None:
        """Search S2 and return best match info.

        Returns:
            ``(bibtex_or_none, score, url, doi_or_none)`` or ``None`` on no results/error.
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

        # Track best match with BibTeX and best overall match for DOI
        best_bibtex: str | None = None
        best_bibtex_score: float = 0.0
        best_bibtex_url: str | None = None

        best_score: float = 0.0
        best_doi: str | None = None

        for paper in papers:
            paper_title = paper.get("title")
            if not paper_title:
                continue

            score = title_similarity(ref.title, paper_title)

            # Extract DOI from externalIds
            paper_doi: str | None = None
            external_ids = paper.get("externalIds")
            if isinstance(external_ids, dict):
                doi_val = external_ids.get("DOI") or external_ids.get("doi")
                if isinstance(doi_val, str) and doi_val.strip():
                    paper_doi = doi_val.strip()

            # Track best overall match for DOI
            if score > best_score:
                best_score = score
                best_doi = paper_doi

            # Track best match with BibTeX
            if score > best_bibtex_score:
                citation_styles = paper.get("citationStyles")
                if citation_styles:
                    bibtex = citation_styles.get("bibtex")
                    if bibtex:
                        paper_url = paper.get("url")
                        if not paper_url and paper_doi:
                            paper_url = f"https://doi.org/{paper_doi}"
                        best_bibtex_score = score
                        best_bibtex = bibtex.strip()
                        best_bibtex_url = paper_url

        # Apply threshold
        if best_score < settings.fuzzy_match_threshold:
            logger.debug(
                "[SemanticScholarService] Best match score=%.3f below threshold=%.2f for title='%s'",
                best_score,
                settings.fuzzy_match_threshold,
                ref.title[:80],
            )
            return None

        # Return bibtex result (may be None) and DOI
        if best_bibtex and best_bibtex_score >= settings.fuzzy_match_threshold:
            logger.info(
                "[SemanticScholarService] Matched with confidence=%.3f for title='%s'",
                best_bibtex_score,
                ref.title[:80],
            )
            return (best_bibtex, best_bibtex_score, best_bibtex_url, best_doi)

        # No BibTeX but found a match with DOI
        if best_doi:
            logger.info(
                "[SemanticScholarService] Found DOI=%s without BibTeX for title='%s'",
                best_doi,
                ref.title[:80],
            )
        return (None, best_score, None, best_doi)
