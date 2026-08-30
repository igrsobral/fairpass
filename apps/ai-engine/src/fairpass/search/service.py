"""SearchService: one retrieval+rerank pipeline, two surfaces.

The pipeline follows the architecture doc:

    NL query
     -> 1. query understanding (extractor -> SearchQuery)
     -> 2. hard filters (Qdrant payload filters, incl. budget as price cap)
     -> 3. Qdrant hybrid (dense + sparse, RRF fusion)
     -> 4. business rerank (deviation + trust) with per-result "why" fields
     -> 5. results capped at 20

``sync_index`` fans active listings from Postgres into Qdrant (dense via the
configured embedder, sparse via the BM25 vectorizer) and removes stale points.
"""

from __future__ import annotations

import datetime
import logging
from typing import Any

from fairpass.search.bm25 import SparseVectorizer
from fairpass.search.embed import Embedder
from fairpass.search.extract import QueryExtractor
from fairpass.search.reranker import RerankInput, rerank
from fairpass.search.schemas import ListingResult, SearchQuery, SearchResponse
from fairpass.search.storage import QdrantStore

logger = logging.getLogger(__name__)

MAX_RESULTS = 20


def _delta_ms_ceil(secs_float: float) -> int:
    return int(secs_float * 1000 + 0.5)


class SearchService:
    def __init__(
        self,
        store: QdrantStore,
        embedder: Embedder,
        vectorizer: SparseVectorizer,
        extractor: QueryExtractor,
        database_url: str = "",
    ) -> None:
        self.store = store
        self.embedder = embedder
        self.vectorizer = vectorizer
        self.extractor = extractor
        self.database_url = database_url

    async def ensure_collection(self) -> None:
        await self.store.ensure_collection()

    async def sync_index(self) -> dict[str, Any]:
        """Read active listings from Postgres and rebuild the Qdrant index."""
        if not self.database_url:
            raise RuntimeError("database_url not configured for index sync")

        import asyncpg

        rows = await self._fetch_active_listings(asyncpg)
        if not rows:
            logger.info("asyncpg: no active listings to index for %s", self.store.collection)

        docs: list[dict[str, Any]] = []
        texts: list[str] = []
        for row in rows:
            deviation = (
                (row["price_cents"] - row["face_value_cents"])
                / max(row["face_value_cents"], 1)
                * 100
            )
            doc = {
                "listing_id": str(row["id"]),
                "event_title": row["event_title"] or "",
                "event_date": row["event_date"],  # ISO
                "event_start_ms": row["event_start_ms"],
                "city": row["city"] or "",
                "artist": row["artist"] or "",
                "category": row["category"] or "",
                "tier": row["tier"],
                "section": row["section"],
                "row": row["row"],
                "seat": row["seat"],
                "face_value_cents": row["face_value_cents"],
                "price_cents": row["price_cents"],
                "currency": row["currency"],
                "deviation_pct": round(deviation, 2),
                "seller_trust_score": row["seller_trust_score"],
                "status": "active",
            }
            docs.append(doc)
            texts.append(self._doc_text(doc))

        # BM25 vocabulary is rebuilt per sync over the *current* corpus.
        self.vectorizer.fit(texts)
        dense_vectors = await self.embedder.embed_batch(texts)

        fresh_ids: list[str] = []
        for doc, dense in zip(docs, dense_vectors):
            indices, values = self.vectorizer.encode(self._doc_text(doc))
            await self.store.upsert(
                doc["listing_id"],
                dense,
                indices,
                values,
                payload=doc,
            )
            fresh_ids.append(doc["listing_id"])

        removed = await self._drop_stale(fresh_ids)
        total = await self.store.count()
        return {
            "indexed": len(fresh_ids),
            "removed_stale": len(removed),
            "total": total,
            "embedding_provider": type(self.embedder).__name__,
            "sparse_vocabulary_size": self.vectorizer.vocabulary_size,
        }

    async def _drop_stale(self, fresh_ids: list[str]) -> list[str]:
        indexed = await self.store.scroll_payloads()
        stale = [lid for lid in indexed if lid not in set(fresh_ids)]
        if stale:
            await self.store.delete(stale)
        return stale

    async def search(
        self,
        text: str,
        *,
        filters: SearchQuery | None = None,
        now: datetime.datetime | None = None,
    ) -> SearchResponse:
        await self.ensure_collection()
        if not self.store.ready():
            return SearchResponse(query=SearchQuery(), results=[], total=0)

        vocab = await self._load_vocab()
        extracted = await self.extractor.extract(text, vocab=vocab)
        query = self._merge(extracted, filters)

        if not self._has_signal(query):
            # Nothing to retrieve against (pure stopwords) -> return empty.
            return SearchResponse(query=query, results=[], total=0)

        dense_query = await self.embedder.embed(text)
        sparse_idxs, sparse_vals = self.vectorizer.encode(text)
        if not sparse_idxs and not self.embedder.semantic and not self._has_structural(
            query
        ):
            # Non-semantic embedder with zero term overlap on the corpus:
            # dense-only would surface hash-collision noise, not intent.
            return SearchResponse(query=query, results=[], total=0)
        now_ms = _delta_ms_ceil(
            (now or datetime.datetime.now(datetime.timezone.utc)).timestamp()
        )
        filter_ = self.store.build_filter(
            city=query.city,
            event_title=query.event_name,
            artist=query.artist,
            category=query.category,
            tier=query.tier,
            date_from_ms=self._iso_to_ms(query.date_from),
            date_to_ms=self._iso_to_ms(query.date_to, end_of_day=True),
            max_unit_cents=query.max_unit_cents,
            max_total_cents=query.max_total_cents,
            quantity=query.quantity,
            now_ms=now_ms,
        )
        hybrids = await self.store.hybrid_search(
            dense_query,
            sparse_idxs,
            sparse_vals,
            filter_,
            prefetch_dense=MAX_RESULTS,
            prefetch_sparse=MAX_RESULTS * 3,
            fusion_limit=MAX_RESULTS * 2,
        )
        payloads = await self.store.get_payloads([h.listing_id for h in hybrids])
        rerank_inputs = [
            RerankInput(
                listing_id=h.listing_id,
                fused_score=h.fused_score,
                payload=payloads.get(h.listing_id, {}),
            )
            for h in hybrids
            if h.listing_id in payloads
        ]
        results = rerank(rerank_inputs, limit=MAX_RESULTS)
        return SearchResponse(query=query, results=results, total=len(results))

    async def status(self) -> dict[str, Any]:
        return {
            "collection": self.store.collection,
            "points": await self.store.count(),
            "ready": self.store.ready(),
            "embedding_provider": type(self.embedder).__name__,
            "sparse_vocabulary_size": self.vectorizer.vocabulary_size,
        }

    async def _fetch_active_listings(self, driver: Any) -> list[dict[str, Any]]:
        pool = await driver.create_pool(self.database_url, min_size=1, max_size=2)
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT
                      l.id,
                      l.section, l.row, l.seat, l.tier,
                      l.face_value_cents, l.price_cents, l.currency,
                      e.title AS event_title, e.category, e.artist,
                      v.city,
                      d.starts_at,
                      COALESCE(s.score, 0.0) AS seller_trust_score
                    FROM ticket_listings l
                    JOIN event_dates d ON l.event_date_id = d.id
                    JOIN events e ON d.event_id = e.id
                    LEFT JOIN venues v ON e.venue_id = v.id
                    LEFT JOIN seller_trust_scores s ON s.seller_id = l.seller_id
                    WHERE l.status = 'active'
                      AND d.starts_at > now()
                    """
                )
        finally:
            await pool.close()

        out: list[dict[str, Any]] = []
        for row in rows:
            starts = row["starts_at"]
            out.append(
                {
                    "id": row["id"],
                    "event_title": row["event_title"],
                    "event_date": starts.isoformat(),
                    "event_start_ms": _delta_ms_ceil(starts.timestamp()),
                    "city": row["city"],
                    "artist": row["artist"],
                    "category": row["category"],
                    "tier": row["tier"],
                    "section": row["section"],
                    "row": row["row"],
                    "seat": row["seat"],
                    "face_value_cents": row["face_value_cents"],
                    "price_cents": row["price_cents"],
                    "currency": row["currency"],
                    "seller_trust_score": row["seller_trust_score"],
                }
            )
        return out

    async def _load_vocab(self) -> dict[str, set[str]]:
        payloads = await self.store.scroll_payloads()
        fields = {"city", "event_title", "artist", "category"}
        vocab: dict[str, set[str]] = {f: set() for f in fields}
        for payload in payloads.values():
            for field in fields:
                value = payload.get(field)
                if value:
                    vocab[field].add(str(value))
        return vocab

    def _merge(self, extracted: SearchQuery, filters: SearchQuery | None) -> SearchQuery:
        if filters is None:
            return extracted
        merged = extracted.model_copy(deep=True)
        for field in SearchQuery.model_fields:
            override = getattr(filters, field)
            if override is not None:
                setattr(merged, field, override)
        return merged

    def _has_signal(self, query: SearchQuery) -> bool:
        return any(
            (
                query.event_name,
                query.artist,
                query.city,
                query.category,
                query.tier,
                query.date_from,
                query.date_to,
                query.keywords,
            )
        )

    @staticmethod
    def _has_structural(query: SearchQuery) -> bool:
        return any(
            (
                query.event_name,
                query.artist,
                query.city,
                query.category,
                query.tier,
                query.date_from,
                query.date_to,
            )
        )

    @staticmethod
    def _iso_to_ms(iso: str | None, *, end_of_day: bool = False) -> int | None:
        if not iso:
            return None
        date = datetime.date.fromisoformat(iso.split("T")[0])
        if end_of_day:
            dt = datetime.datetime.combine(
                date, datetime.time(23, 59, 59, tzinfo=datetime.timezone.utc)
            )
        else:
            dt = datetime.datetime.combine(
                date, datetime.time.min, tzinfo=datetime.timezone.utc
            )
        return _delta_ms_ceil(dt.timestamp())

    @staticmethod
    def _doc_text(doc: dict[str, Any]) -> str:
        parts = [
            doc.get("event_title", ""),
            doc.get("artist", ""),
            doc.get("city", ""),
            doc.get("category", ""),
            doc.get("tier", ""),
            doc.get("section", ""),
            doc.get("row", ""),
            doc.get("seat", ""),
        ]
        return " ".join(part for part in parts if part)