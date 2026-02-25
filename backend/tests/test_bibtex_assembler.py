"""Tests for citation-key deduplication in BibTeX assembler."""

from app.models.reference import MatchSource, MatchStatus, ResolvedReference
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
