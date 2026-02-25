"""Tests for citation-key handling and URL propagation in BibTeX assembler."""

import asyncio
from unittest.mock import AsyncMock

from app.models.reference import (
    MatchSource,
    MatchStatus,
    ParsedReference,
    ResolvedReference,
)
from app.services.bibtex_assembler import BibTeXAssembler


def _resolved_ref(index: int, citation_key: str, bibtex: str) -> ResolvedReference:
    return ResolvedReference(
        index=index,
        raw_citation=f"raw-{index}",
        title="A Shared Title",
        authors=["Smith, J."],
        year=2024,
        doi=None,
        venue=None,
        bibtex=bibtex,
        citation_key=citation_key,
        match_status=MatchStatus.MATCHED,
        match_source=MatchSource.CROSSREF,
    )


def _parsed_ref(index: int, doi: str | None = None) -> ParsedReference:
    return ParsedReference(
        index=index,
        raw_citation=f"raw-{index}",
        title="A Shared Title",
        authors=["Smith, J."],
        year=2024,
        doi=doi,
        venue=None,
    )


def test_duplicate_citation_keys_are_renamed_and_bibtex_is_updated():
    refs = [
        _resolved_ref(1, "smith2024shared", "@article{smith2024shared,\n  title={A}\n}"),
        _resolved_ref(2, "smith2024shared", "@article{smith2024shared,\n  title={B}\n}"),
        _resolved_ref(3, "smith2024shared", "@article{smith2024shared,\n  title={C}\n}"),
    ]

    deduped = BibTeXAssembler._deduplicate_citation_keys(refs)

    assert deduped[0].citation_key == "smith2024shared"
    assert deduped[1].citation_key == "smith2024shared2"
    assert deduped[2].citation_key == "smith2024shared3"

    assert deduped[1].bibtex.startswith("@article{smith2024shared2,")
    assert deduped[2].bibtex.startswith("@article{smith2024shared3,")


def test_waterfall_propagates_url_from_matched_source():
    assembler = BibTeXAssembler(client=AsyncMock())
    ref = _parsed_ref(1)

    assembler.crossref.lookup = AsyncMock(
        return_value=(
            "@article{smith2024shared,\n  title={A}\n}",
            0.95,
            "https://doi.org/10.1000/xyz123",
        )
    )

    resolved = asyncio.run(assembler._waterfall(ref))

    assert resolved.match_source == MatchSource.CROSSREF
    assert resolved.match_status == MatchStatus.MATCHED
    assert resolved.url == "https://doi.org/10.1000/xyz123"


def test_fallback_uses_doi_url_when_present():
    assembler = BibTeXAssembler(client=AsyncMock())
    ref = _parsed_ref(1, doi="10.1000/xyz123")

    assembler.crossref.lookup = AsyncMock(return_value=None)
    assembler.semantic_scholar.lookup = AsyncMock(return_value=None)
    assembler.dblp.lookup = AsyncMock(return_value=None)

    resolved = asyncio.run(assembler._waterfall(ref))

    assert resolved.match_source == MatchSource.GROBID_FALLBACK
    assert resolved.match_status == MatchStatus.UNMATCHED
    assert resolved.url == "https://doi.org/10.1000/xyz123"
