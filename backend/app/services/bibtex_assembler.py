"""Waterfall orchestrator: resolve BibTeX for each parsed reference."""

import asyncio
import logging
import re

import httpx

from app.config import settings
from app.models.reference import (
    MatchSource,
    MatchStatus,
    ParsedReference,
    ResolvedReference,
)
from app.services.crossref_service import CrossRefService
from app.services.dblp_service import DBLPService
from app.services.semanticscholar_service import SemanticScholarService
from app.utils.bibtex_formatter import (
    build_fallback_bibtex,
    generate_citation_key,
)
from app.utils.rate_limiter import TokenBucketRateLimiter

logger = logging.getLogger(__name__)


def _extract_citation_key(bibtex: str) -> str | None:
    """Extract the citation key from a BibTeX entry string."""
    m = re.search(r"@\w+\s*\{([^,]+),", bibtex)
    return m.group(1).strip() if m else None


_BIBTEX_KEY_RE = re.compile(r"^\s*(@\w+\s*\{)\s*([^,]+)(,)", re.MULTILINE)


def _replace_citation_key(bibtex: str, citation_key: str) -> str:
    """Replace the first BibTeX key in an entry while keeping the entry body unchanged."""

    def repl(match: re.Match[str]) -> str:
        return f"{match.group(1)}{citation_key}{match.group(3)}"

    updated, count = _BIBTEX_KEY_RE.subn(repl, bibtex, count=1)
    return updated if count > 0 else bibtex


class BibTeXAssembler:
    """Resolve BibTeX for a list of parsed references using a waterfall strategy.

    Order: CrossRef → Semantic Scholar → DBLP → GROBID fallback.
    References are processed concurrently with a semaphore to respect rate limits.
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        crossref_rate_limiter: TokenBucketRateLimiter | None = None,
        semantic_scholar_rate_limiter: TokenBucketRateLimiter | None = None,
        dblp_rate_limiter: TokenBucketRateLimiter | None = None,
    ) -> None:
        self.crossref = CrossRefService(
            client,
            crossref_rate_limiter
            or TokenBucketRateLimiter(settings.crossref_rps),
        )
        self.semantic_scholar = SemanticScholarService(
            client,
            semantic_scholar_rate_limiter
            or TokenBucketRateLimiter(settings.semantic_scholar_rps),
        )
        self.dblp = DBLPService(
            client,
            dblp_rate_limiter
            or TokenBucketRateLimiter(settings.dblp_rps),
        )
        self.semaphore = asyncio.Semaphore(settings.max_concurrent_lookups)

    async def resolve_all(
        self, refs: list[ParsedReference]
    ) -> list[ResolvedReference]:
        tasks = [self._resolve_one(ref) for ref in refs]
        resolved = await asyncio.gather(*tasks)
        return self._deduplicate_citation_keys(resolved)

    @staticmethod
    def _deduplicate_citation_keys(
        refs: list[ResolvedReference],
    ) -> list[ResolvedReference]:
        deduplicated: list[ResolvedReference] = []
        used_keys: set[str] = set()

        for ref in refs:
            base_key = (ref.citation_key or "").strip() or generate_citation_key(
                ref.authors, ref.year, ref.title
            )
            if not base_key:
                base_key = "unknown"

            candidate = base_key
            suffix = 2
            while candidate in used_keys:
                candidate = f"{base_key}{suffix}"
                suffix += 1
            used_keys.add(candidate)

            if candidate != ref.citation_key:
                updated_bibtex = (
                    _replace_citation_key(ref.bibtex, candidate)
                    if ref.bibtex
                    else None
                )
                ref = ref.model_copy(
                    update={
                        "citation_key": candidate,
                        "bibtex": updated_bibtex,
                    }
                )

            deduplicated.append(ref)

        return deduplicated

    async def _resolve_one(self, ref: ParsedReference) -> ResolvedReference:
        async with self.semaphore:
            return await self._waterfall(ref)

    async def _waterfall(self, ref: ParsedReference) -> ResolvedReference:
        """Try each source in order until a BibTeX match is found."""
        sources: list[tuple[MatchSource, object]] = [
            (MatchSource.CROSSREF, self.crossref),
            (MatchSource.SEMANTIC_SCHOLAR, self.semantic_scholar),
            (MatchSource.DBLP, self.dblp),
        ]

        for source_type, service in sources:
            try:
                result = await service.lookup(ref)
                if result:
                    bibtex, confidence = result
                    status = (
                        MatchStatus.MATCHED
                        if confidence >= settings.exact_match_threshold
                        else MatchStatus.FUZZY
                    )
                    citation_key = _extract_citation_key(bibtex) or generate_citation_key(
                        ref.authors, ref.year, ref.title
                    )
                    logger.info(
                        "[BibTeXAssembler] ref #%d resolved via %s (confidence=%.2f)",
                        ref.index, source_type.value, confidence,
                    )
                    return ResolvedReference(
                        **ref.model_dump(),
                        bibtex=bibtex,
                        citation_key=citation_key,
                        match_status=status,
                        match_source=source_type,
                    )
            except (httpx.HTTPError, httpx.TimeoutException, ValueError, KeyError):
                logger.exception(
                    "[BibTeXAssembler] Error from %s for ref #%d",
                    source_type.value, ref.index,
                )

        # Fallback: construct BibTeX from GROBID-parsed data
        logger.info(
            "[BibTeXAssembler] ref #%d using GROBID fallback", ref.index
        )
        fallback_bibtex = build_fallback_bibtex(ref)
        citation_key = generate_citation_key(ref.authors, ref.year, ref.title)
        return ResolvedReference(
            **ref.model_dump(),
            bibtex=fallback_bibtex,
            citation_key=citation_key,
            match_status=MatchStatus.UNMATCHED,
            match_source=MatchSource.GROBID_FALLBACK,
        )
