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
        resolved_list = list(resolved)

        # Second pass: retry unmatched references with lower concurrency
        unmatched_indices = [
            i
            for i, r in enumerate(resolved_list)
            if r.match_source == MatchSource.GROBID_FALLBACK
        ]
        if unmatched_indices:
            logger.info(
                "[BibTeXAssembler] Second pass: retrying %d unmatched references",
                len(unmatched_indices),
            )
            retry_sem = asyncio.Semaphore(3)

            async def _retry_one(idx: int) -> tuple[int, ResolvedReference]:
                async with retry_sem:
                    await asyncio.sleep(0.5)
                    result = await self._waterfall(refs[idx])
                    return (idx, result)

            retry_tasks = [_retry_one(i) for i in unmatched_indices]
            retry_results = await asyncio.gather(*retry_tasks)

            improved = 0
            for idx, result in retry_results:
                if result.match_source != MatchSource.GROBID_FALLBACK:
                    resolved_list[idx] = result
                    improved += 1

            logger.info(
                "[BibTeXAssembler] Second pass improved %d/%d references",
                improved,
                len(unmatched_indices),
            )

        return self._deduplicate_citation_keys(resolved_list)

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

    def _build_resolved(
        self,
        ref: ParsedReference,
        bibtex: str,
        confidence: float,
        source: MatchSource,
        url: str | None,
    ) -> ResolvedReference:
        """Build a ResolvedReference from a successful lookup."""
        status = (
            MatchStatus.MATCHED
            if confidence >= settings.exact_match_threshold
            else MatchStatus.FUZZY
        )
        citation_key = _extract_citation_key(bibtex) or generate_citation_key(
            ref.authors, ref.year, ref.title
        )
        return ResolvedReference(
            **ref.model_dump(),
            bibtex=bibtex,
            citation_key=citation_key,
            match_status=status,
            match_source=source,
            url=url,
        )

    async def _waterfall(self, ref: ParsedReference) -> ResolvedReference:
        """Try each source in order until a BibTeX match is found."""

        # Step 1: CrossRef
        try:
            result = await self.crossref.lookup(ref)
            if result:
                bibtex, confidence, url = result
                logger.info(
                    "[BibTeXAssembler] ref #%d resolved via %s (confidence=%.2f)",
                    ref.index, MatchSource.CROSSREF.value, confidence,
                )
                return self._build_resolved(
                    ref, bibtex, confidence, MatchSource.CROSSREF, url
                )
        except (httpx.HTTPError, httpx.TimeoutException, ValueError, KeyError):
            logger.exception(
                "[BibTeXAssembler] Error from %s for ref #%d",
                MatchSource.CROSSREF.value, ref.index,
            )

        # Step 2: Semantic Scholar (with DOI handoff)
        try:
            s2_result, s2_doi = await self.semantic_scholar.lookup_with_doi(ref)
            if s2_result:
                bibtex, confidence, url = s2_result
                logger.info(
                    "[BibTeXAssembler] ref #%d resolved via %s (confidence=%.2f)",
                    ref.index, MatchSource.SEMANTIC_SCHOLAR.value, confidence,
                )
                return self._build_resolved(
                    ref, bibtex, confidence, MatchSource.SEMANTIC_SCHOLAR, url
                )

            # S2 found DOI but no BibTeX — hand off to CrossRef if it's a new DOI
            if s2_doi and s2_doi != ref.doi:
                logger.info(
                    "[BibTeXAssembler] S2 found DOI=%s for ref #%d, handing off to CrossRef",
                    s2_doi, ref.index,
                )
                ref_with_doi = ref.model_copy(update={"doi": s2_doi})
                crossref_result = await self.crossref.lookup(ref_with_doi)
                if crossref_result:
                    bibtex, confidence, url = crossref_result
                    logger.info(
                        "[BibTeXAssembler] ref #%d resolved via S2→CrossRef handoff (confidence=%.2f)",
                        ref.index, confidence,
                    )
                    return self._build_resolved(
                        ref, bibtex, confidence, MatchSource.CROSSREF, url
                    )
        except (httpx.HTTPError, httpx.TimeoutException, ValueError, KeyError):
            logger.exception(
                "[BibTeXAssembler] Error from %s for ref #%d",
                MatchSource.SEMANTIC_SCHOLAR.value, ref.index,
            )

        # Step 3: DBLP
        try:
            result = await self.dblp.lookup(ref)
            if result:
                bibtex, confidence, url = result
                logger.info(
                    "[BibTeXAssembler] ref #%d resolved via %s (confidence=%.2f)",
                    ref.index, MatchSource.DBLP.value, confidence,
                )
                return self._build_resolved(
                    ref, bibtex, confidence, MatchSource.DBLP, url
                )
        except (httpx.HTTPError, httpx.TimeoutException, ValueError, KeyError):
            logger.exception(
                "[BibTeXAssembler] Error from %s for ref #%d",
                MatchSource.DBLP.value, ref.index,
            )

        # Fallback: construct BibTeX from GROBID-parsed data
        logger.info(
            "[BibTeXAssembler] ref #%d using GROBID fallback", ref.index
        )
        fallback_bibtex = build_fallback_bibtex(ref)
        citation_key = generate_citation_key(ref.authors, ref.year, ref.title)
        fallback_url = f"https://doi.org/{ref.doi}" if ref.doi else None
        return ResolvedReference(
            **ref.model_dump(),
            bibtex=fallback_bibtex,
            citation_key=citation_key,
            match_status=MatchStatus.UNMATCHED,
            match_source=MatchSource.GROBID_FALLBACK,
            url=fallback_url,
        )
