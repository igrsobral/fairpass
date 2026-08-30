"""Qdrant storage: named dense+sparse vectors, RRF hybrid query, payload filters.

Collection layout (created idempotently):
- ``dense`` named vector  — embedder dimensions (cosine)
- ``sparse`` named vector — BM25 term weights (dot)

Payload fields on every point:
listing_id, event_title (text), city (text), artist (text), category (text),
tier (text), section/row/seat (nullable text), face_value_cents, price_cents,
currency, deviation_pct, seller_trust_score, event_start_ms, quantity.
"""

from __future__ import annotations

from dataclasses import dataclass

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models


def point_id(listing_id: str) -> str:
    # Listing ids are Postgres UUIDs, which Qdrant accepts natively.
    return listing_id


@dataclass
class HybridResult:
    listing_id: str
    fused_score: float


class QdrantStore:
    def __init__(
        self,
        url: str,
        collection: str,
        dense_dims: int,
        timeout: float = 10.0,
    ) -> None:
        self.client = AsyncQdrantClient(url=url, timeout=timeout)
        self.collection = collection
        self.dense_dims = dense_dims
        self._ready: bool | None = None

    async def ensure_collection(self) -> None:
        exists = await self.client.collection_exists(self.collection)
        if exists:
            self._ready = True
            return
        await self.client.create_collection(
            collection_name=self.collection,
            vectors_config={
                "dense": models.VectorParams(
                    size=self.dense_dims, distance=models.Distance.COSINE
                ),
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams(),
            },
            on_disk_payload=True,
        )
        # Scalar indexes over the hard-filter payload keys.
        for payload_key in (
            "listing_id",
            "event_title",
            "city",
            "category",
            "tier",
            "price_cents",
            "event_start_ms",
            "status",
        ):
            try:
                await self.client.create_payload_index(
                    collection_name=self.collection,
                    field_name=payload_key,
                    field_schema=models.KeywordIndexParams(
                        type=models.PayloadSchemaType.KEYWORD
                    ),
                )
            except Exception:
                continue
        self._ready = True

    def ready(self) -> bool:
        return bool(self._ready)

    async def upsert(
        self,
        listing_id: str,
        dense: list[float],
        sparse_indices: list[int],
        sparse_values: list[float],
        payload: dict,
    ) -> None:
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=point_id(listing_id),
                    vector={
                        "dense": dense,
                        "sparse": models.SparseVector(
                            indices=sparse_indices, values=sparse_values
                        ),
                    },
                    payload=payload,
                )
            ],
        )

    async def delete(self, listing_ids: list[str]) -> None:
        ids = [point_id(lid) for lid in listing_ids]
        if ids:
            await self.client.delete(
                collection_name=self.collection,
                points_selector=models.PointIdsList(points=ids),
            )

    async def count(self) -> int:
        try:
            info = await self.client.count(
                collection_name=self.collection, exact=True
            )
            return info.count
        except Exception:
            return 0

    async def get_payloads(self, listing_ids: list[str]) -> dict[str, dict]:
        ids = [point_id(lid) for lid in listing_ids]
        if not ids:
            return {}
        response = await self.client.retrieve(
            collection_name=self.collection,
            ids=ids,
            with_payload=True,
            with_vectors=False,
        )
        return {
            str(point.id): dict(point.payload or {}) for point in response
        }

    async def scroll_payloads(self, limit: int = 10_000) -> dict[str, dict]:
        out: dict[str, dict] = {}
        next_offset: object | None = None
        while True:
            page = await self.client.scroll(
                collection_name=self.collection,
                limit=min(limit, 1000),
                offset=next_offset,
                with_payload=True,
                with_vectors=False,
            )
            for point in page[0]:
                out[str(point.id)] = dict(point.payload or {})
            next_offset = page[1]
            if next_offset is None:
                break
        return out

    async def drop(self) -> None:
        try:
            await self.client.delete_collection(self.collection)
        except Exception:
            pass

    def _to_filter(self, must: list[models.FieldCondition]) -> models.Filter:
        return models.Filter(
            must=must,
            must_not=[
                models.FieldCondition(
                    key="status", match=models.MatchValue(value="cancelled")
                )
            ],
        )

    def build_filter(
        self,
        *,
        city: str | None,
        event_title: str | None,
        artist: str | None,
        category: str | None,
        tier: str | None,
        date_from_ms: int | None,
        date_to_ms: int | None,
        max_unit_cents: int | None,
        max_total_cents: int | None,
        quantity: int,
        now_ms: int,
    ) -> models.Filter:
        must: list[models.FieldCondition] = []
        if city:
            must.append(
                models.FieldCondition(
                    key="city", match=models.MatchValue(value=city)
                )
            )
        if event_title:
            must.append(
                models.FieldCondition(
                    key="event_title",
                    match=models.MatchValue(value=event_title),
                )
            )
        if artist:
            must.append(
                models.FieldCondition(
                    key="artist", match=models.MatchValue(value=artist)
                )
            )
        if category:
            must.append(
                models.FieldCondition(
                    key="category", match=models.MatchValue(value=category)
                )
            )
        if tier:
            must.append(
                models.FieldCondition(
                    key="tier", match=models.MatchValue(value=tier)
                )
            )
        if date_from_ms:
            must.append(
                models.FieldCondition(
                    key="event_start_ms",
                    range=models.Range(gte=date_from_ms),
                )
            )
        if date_to_ms:
            must.append(
                models.FieldCondition(
                    key="event_start_ms",
                    range=models.Range(lte=date_to_ms),
                )
            )
        always_open = models.Filter(
            must=[
                models.FieldCondition(
                    key="event_start_ms", range=models.Range(gte=now_ms)
                )
            ],
            must_not=[
                models.FieldCondition(
                    key="status", match=models.MatchValue(value="cancelled")
                )
            ],
        )
        per_ticket_budget = None
        if max_total_cents is not None and quantity:
            per_ticket_budget = max_total_cents // quantity
        caps = [
            candidate
            for candidate in (max_unit_cents, per_ticket_budget)
            if candidate is not None
        ]
        if caps:
            must.append(
                models.FieldCondition(
                    key="price_cents", range=models.Range(lte=min(caps))
                )
            )
        return models.Filter(
            must=always_open.must + must,
            must_not=always_open.must_not,
        )

    async def hybrid_search(
        self,
        dense_query: list[float],
        sparse_indices: list[int],
        sparse_values: list[float],
        filter_: models.Filter,
        *,
        prefetch_dense: int,
        prefetch_sparse: int,
        fusion_limit: int,
    ) -> list[HybridResult]:
        prefetches = [
            models.Prefetch(
                query=dense_query,
                using="dense",
                filter=filter_,
                limit=prefetch_dense,
            ),
            models.Prefetch(
                query=models.SparseVector(
                    indices=sparse_indices, values=sparse_values
                ),
                using="sparse",
                filter=filter_,
                limit=prefetch_sparse,
            ),
        ]
        response = await self.client.query_points(
            collection_name=self.collection,
            prefetch=prefetches,
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=fusion_limit,
            with_payload=False,
        )
        points = response.points
        out: list[HybridResult] = []
        for point in points:
            out.append(
                HybridResult(
                    listing_id=str(point.id),
                    fused_score=float(point.score),
                )
            )
        if out:
            top = max(r.fused_score for r in out)
            if top > 0:
                for r in out:
                    r.fused_score /= top
        return out