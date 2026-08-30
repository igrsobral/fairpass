"""Deterministic business rerank.

Fuses the retrieval relevance with two business signals so that honest,
trusted sellers win ties over scalpers:

    final = w_rel * relevance + w_honesty * honesty + w_trust * trust
    honesty = clamp(1 - deviation_pct / 150, 0, 1)
    trust   = seller_trust_score (0..1)

Ties are broken deterministically (lower price first, then listing id). The
``relevance_score`` reported on results stays the pure fused retrieval score.
"""

from __future__ import annotations

from dataclasses import dataclass

from fairpass.search.schemas import ListingResult

W_REL = 0.5
W_HONESTY = 0.3
W_TRUST = 0.2
MAX_DEVIATION_TOLERATED = 150.0


@dataclass
class RerankInput:
    listing_id: str
    fused_score: float
    payload: dict


def _honesty(deviation_pct: float) -> float:
    return max(0.0, min(1.0, 1.0 - deviation_pct / MAX_DEVIATION_TOLERATED))


def rerank(results: list[RerankInput], *, limit: int = 20) -> list[ListingResult]:
    scored: list[tuple[float, RerankInput]] = []
    for item in results:
        deviation = float(item.payload.get("deviation_pct", 0.0))
        trust = float(item.payload.get("seller_trust_score", 0.0))
        rel = float(item.fused_score)
        final = (
            W_REL * rel
            + W_HONESTY * _honesty(deviation)
            + W_TRUST * trust
        )
        scored.append((final, item))
    scored.sort(
        key=lambda pair: (
            -pair[0],
            int(pair[1].payload.get("price_cents", 0)),
            pair[1].listing_id,
        )
    )
    out: list[ListingResult] = []
    for _, item in scored[:limit]:
        p = item.payload
        out.append(
            ListingResult(
                listing_id=item.listing_id,
                event_title=str(p.get("event_title", "")),
                event_date=str(p.get("event_date", "")),
                city=str(p.get("city", "")),
                section=p.get("section"),
                row=p.get("row"),
                seat=p.get("seat"),
                tier=str(p.get("tier", "standard")),
                face_value_cents=int(p.get("face_value_cents", 0)),
                price_cents=int(p.get("price_cents", 0)),
                currency=str(p.get("currency", "USD")),
                deviation_pct=float(p.get("deviation_pct", 0.0)),
                seller_trust_score=float(p.get("seller_trust_score", 0.0)),
                relevance_score=item.fused_score,
            )
        )
    return out