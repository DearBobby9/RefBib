"""API request/response models."""

import re
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.reference import ResolvedReference


class ExtractResponse(BaseModel):
    references: list[ResolvedReference]
    total_count: int
    matched_count: int
    fuzzy_count: int
    unmatched_count: int
    processing_time_seconds: float


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Human-readable error message")


class DiscoveryStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    ERROR = "error"
    SKIPPED = "skipped"


class DiscoverySource(str, Enum):
    CROSSREF = "crossref"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    DBLP = "dblp"


class DiscoveryResult(BaseModel):
    index: int
    discovery_status: DiscoveryStatus
    available_on: list[DiscoverySource] = Field(default_factory=list)
    best_confidence: float | None = None
    best_url: str | None = None
    reason: str | None = None


_DOI_PATTERN = re.compile(r"^10\.\d{4,}/.+$")
_MAX_TITLE_LENGTH = 500
_MAX_RAW_CITATION_LENGTH = 2000


class DiscoveryReferenceInput(BaseModel):
    """Input model for a single reference in a discovery check request.

    Separate from ParsedReference to decouple the public API from internal models
    and to enforce input validation constraints.
    """

    index: int = Field(..., description="1-based index of the reference")
    raw_citation: str = Field(
        default="",
        max_length=_MAX_RAW_CITATION_LENGTH,
        description="Raw citation string",
    )
    title: Optional[str] = Field(default=None, description="Parsed title")
    authors: list[str] = Field(default_factory=list, description="Author list")
    year: Optional[int] = Field(default=None, description="Publication year")
    doi: Optional[str] = Field(default=None, description="DOI identifier")
    venue: Optional[str] = Field(default=None, description="Journal or conference")

    @field_validator("title")
    @classmethod
    def validate_title_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > _MAX_TITLE_LENGTH:
            return v[:_MAX_TITLE_LENGTH]
        return v

    @field_validator("doi")
    @classmethod
    def validate_doi_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not _DOI_PATTERN.match(v):
            return None
        return v


class DiscoveryCheckRequest(BaseModel):
    references: list[DiscoveryReferenceInput]
    max_items: int = Field(default=20, ge=1)


class DiscoveryCheckResponse(BaseModel):
    results: list[DiscoveryResult]
