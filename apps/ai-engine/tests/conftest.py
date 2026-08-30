"""Shared fixtures. Requires the compose Qdrant container on 6335.

Each test-suite run uses a unique throwaway collection so dev data on
``ticket_listings`` is never touched; the collection is dropped when the
session finishes.
"""

from __future__ import annotations

import datetime
import uuid
from collections.abc import AsyncIterator

import pytest_asyncio

from fairpass.search.bm25 import SparseVectorizer
from fairpass.search.embed import LocalEmbedder
from fairpass.search.extract import LocalQueryExtractor
from fairpass.search.service import SearchService
from fairpass.search.storage import QdrantStore


def _days_from_now(days: int, hour: int = 20) -> int:
    dt = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=days)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return int(dt.timestamp() * 1000 + 0.5)


# Fully deterministic catalog with fixed UUID listing ids, mirroring the seed
# qualitatively: honest trusted seller vs casual / scalper markup.
CATALOG: list[dict] = [
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000a"), event_title="Oasis Live '26", city="Buenos Aires", artist="Oasis", category="concert", tier="budget", section="Campo", row="GA", seat="..", face=9000, price=9000, trust=0.86, start=_days_from_now(40)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000b"), event_title="Oasis Live '26", city="Buenos Aires", artist="Oasis", category="concert", tier="budget", section="Campo", row="GA", seat="..", face=9000, price=13500, trust=0.40, start=_days_from_now(40)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000c"), event_title="Oasis Live '26", city="Buenos Aires", artist="Oasis", category="concert", tier="standard", section="Platea Baja", row="9", seat="12", face=9000, price=36000, trust=0.40, start=_days_from_now(40)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000d"), event_title="Oasis Live '26", city="Buenos Aires", artist="Oasis", category="concert", tier="premium", section="Platea Baja", row="2", seat="9", face=14000, price=70000, trust=0.40, start=_days_from_now(40)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000e"), event_title="Taylor Swift: The Eras Tour", city="Dublin", artist="Taylor Swift", category="concert", tier="standard", section="D 200", row="H", seat="47", face=22000, price=33000, trust=0.40, start=_days_from_now(62)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-00000000000f"), event_title="Taylor Swift: The Eras Tour", city="Dublin", artist="Taylor Swift", category="concert", tier="budget", section="D 500", row="P", seat="112", face=12000, price=44000, trust=0.40, start=_days_from_now(62)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-000000000010"), event_title="Coldplay: Music of the Spheres", city="Leipzig", artist="Coldplay", category="concert", tier="premium", section="Innenraum", row="12", seat="3", face=16000, price=17600, trust=0.86, start=_days_from_now(34)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-000000000011"), event_title="Coldplay: Music of the Spheres", city="Leipzig", artist="Coldplay", category="concert", tier="premium", section="Innenraum", row="1", seat="5", face=15000, price=52500, trust=0.40, start=_days_from_now(34)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-000000000012"), event_title="Inter Miami cf. River Plate", city="Buenos Aires", artist=None, category="sports", tier="budget", section="Sivori", row="21", seat="66", face=12000, price=16800, trust=0.40, start=_days_from_now(23)),
    dict(id=uuid.UUID("00000000-0000-4000-8000-000000000013"), event_title="F1 São Paulo Grand Prix", city="São Paulo", artist=None, category="sports", tier="premium", section="Tribuna B", row="3", seat="1", face=24000, price=96000, trust=0.40, start=_days_from_now(86)),
]

GOLD: list[dict] = [
    {"query": "oasis tickets in buenos aires", "relevant": ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b", "00000000-0000-4000-8000-00000000000c", "00000000-0000-4000-8000-00000000000d"]},
    {"query": "oasis under $100", "relevant": ["00000000-0000-4000-8000-00000000000a"]},
    {"query": "2 tickets for oasis under $180 total", "relevant": ["00000000-0000-4000-8000-00000000000a"]},
    {"query": "coldplay premium concert", "relevant": ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011"]},
    {"query": "taylor swift the eras tour dublin", "relevant": ["00000000-0000-4000-8000-00000000000e", "00000000-0000-4000-8000-00000000000f"]},
    {"query": "inter miami soccer in buenos aires", "relevant": ["00000000-0000-4000-8000-000000000012"]},
]


def _doc_text(c: dict) -> str:
    parts = [c["event_title"], c.get("artist") or "", c["city"], c["category"], c["tier"], c["section"], c["row"], c["seat"]]
    return " ".join(part for part in parts if part)


async def _build_service(collection: str) -> SearchService:
    embedder = LocalEmbedder()
    store = QdrantStore(
        url="http://localhost:6335",
        collection=collection,
        dense_dims=embedder.dimensions,
    )
    service = SearchService(
        store=store,
        embedder=embedder,
        vectorizer=SparseVectorizer(),
        extractor=LocalQueryExtractor(),
    )
    await service.ensure_collection()

    texts = [_doc_text(c) for c in CATALOG]
    service.vectorizer.fit(texts)
    dense = await embedder.embed_batch(texts)
    for c, d in zip(CATALOG, dense):
        indices, values = service.vectorizer.encode(_doc_text(c))
        deviation = (c["price"] - c["face"]) / max(c["face"], 1) * 100
        await store.upsert(
            str(c["id"]),
            d,
            indices,
            values,
            payload={
                "listing_id": str(c["id"]),
                "event_title": c["event_title"],
                "event_date": datetime.date.today().isoformat(),
                "event_start_ms": c["start"],
                "city": c["city"],
                "artist": c.get("artist") or "",
                "category": c["category"],
                "tier": c["tier"],
                "section": c["section"],
                "row": c["row"],
                "seat": c["seat"],
                "face_value_cents": c["face"],
                "price_cents": c["price"],
                "currency": "USD",
                "deviation_pct": round(deviation, 2),
                "seller_trust_score": c["trust"],
                "status": "active",
            },
        )
    return service


@pytest_asyncio.fixture(scope="session")
async def service() -> AsyncIterator[SearchService]:
    collection = f"test_search_{uuid.uuid4().hex[:12]}"
    svc = await _build_service(collection)
    yield svc
    await svc.store.drop()