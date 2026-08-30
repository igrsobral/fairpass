"""Pydantic mirrors of the schema-first contract.

Kept field-for-field aligned with ``packages/api/src/types.ts`` (searchQuerySchema,
listtingResultSchema, searchResponseSchema). Money in integer cents.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SearchQuery(BaseModel):
    """Structured query extracted from a natural-language request."""

    model_config = ConfigDict(extra="ignore")

    intent: str = "buy"  # buy | sell | alert | info
    event_name: str | None = None
    artist: str | None = None
    city: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    quantity: int = Field(default=1, ge=1, le=8)
    max_total_cents: int | None = None
    max_unit_cents: int | None = None
    tier: str | None = None  # premium | standard | budget
    category: str | None = None
    keywords: list[str] | None = None


class ListingResult(BaseModel):
    listing_id: str
    event_title: str
    event_date: str
    city: str
    section: str | None
    row: str | None
    seat: str | None
    tier: str
    face_value_cents: int
    price_cents: int
    currency: str
    deviation_pct: float
    seller_trust_score: float
    relevance_score: float  # 0..1 fused retrieval score


class SearchResponse(BaseModel):
    query: SearchQuery
    results: list[ListingResult] = Field(default_factory=list, max_length=20)
    total: int = 0