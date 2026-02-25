"""Data models for parsed and resolved references."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MatchStatus(str, Enum):
    """Status of BibTeX matching for a reference."""

    MATCHED = "matched"
    FUZZY = "fuzzy"
    UNMATCHED = "unmatched"


class MatchSource(str, Enum):
    """Source where the BibTeX entry was found."""

    CROSSREF = "crossref"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    DBLP = "dblp"
    GROBID_FALLBACK = "grobid_fallback"


class ParsedReference(BaseModel):
    """A reference extracted from a PDF by GROBID, before BibTeX resolution."""

    index: int = Field(..., description="1-based index of the reference in the PDF")
    raw_citation: str = Field(
        default="", description="Raw citation string from the PDF"
    )
    title: Optional[str] = Field(
        default=None, description="Parsed title of the referenced work"
    )
    authors: list[str] = Field(
        default_factory=list, description="List of authors (format: 'Surname, F.')"
    )
    year: Optional[int] = Field(default=None, description="Publication year")
    doi: Optional[str] = Field(default=None, description="DOI identifier")
    venue: Optional[str] = Field(
        default=None, description="Journal, conference, or book title"
    )


class ResolvedReference(ParsedReference):
    """A reference with resolved BibTeX entry and match metadata."""

    bibtex: Optional[str] = Field(
        default=None, description="Full BibTeX entry string"
    )
    citation_key: Optional[str] = Field(
        default=None, description="BibTeX citation key (e.g., 'vaswani2017attention')"
    )
    match_status: MatchStatus = Field(
        default=MatchStatus.UNMATCHED,
        description="How well the BibTeX entry matched the parsed reference",
    )
    match_source: Optional[MatchSource] = Field(
        default=None, description="Which API provided the BibTeX entry"
    )
