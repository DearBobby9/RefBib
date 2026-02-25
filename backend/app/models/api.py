"""API request/response models."""

from pydantic import BaseModel, Field

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
