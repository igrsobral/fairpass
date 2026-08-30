from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from fairpass.config import settings
from fairpass.search.bm25 import SparseVectorizer
from fairpass.search.embed import make_embedder
from fairpass.search.extract import make_extractor
from fairpass.search.schemas import SearchQuery, SearchResponse
from fairpass.search.service import SearchService
from fairpass.search.storage import QdrantStore

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    environment: str
    qdrant_url: str
    qdrant_ready: bool


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    filters: dict | None = None


class SyncResponse(BaseModel):
    indexed: int
    removed_stale: int
    total: int
    embedding_provider: str
    sparse_vocabulary_size: int


def build_search_service() -> SearchService:
    embedder = make_embedder(
        settings.embedding_provider,
        settings.openai_api_key,
        settings.embedding_model,
    )
    extractor = make_extractor(
        settings.query_extractor,
        settings.openai_api_key,
        settings.openai_model,
    )
    store = QdrantStore(
        url=settings.qdrant_url,
        collection=settings.qdrant_collection,
        dense_dims=embedder.dimensions,
    )
    return SearchService(
        store=store,
        embedder=embedder,
        vectorizer=SparseVectorizer(),
        extractor=extractor,
        database_url=settings.database_url,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = build_search_service()
    app.state.search_service = service
    try:
        await service.ensure_collection()
        logger.info(
            "search collection '%s' ready (embedder=%s)",
            service.store.collection,
            type(service.embedder).__name__,
        )
    except Exception as exc:  # pragma: no cover - depends on container state
        logger.warning("search collection unavailable at startup: %s", exc)
    yield


app = FastAPI(
    title="FairPass AI Engine",
    description=(
        "Search (hybrid retrieval + rerank), the LangGraph matchmaking agent, "
        "and tool gateway for listing verification."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    service: SearchService = app.state.search_service
    qdrant_ready = service is not None and service.store.ready()
    return HealthResponse(
        status="ok" if qdrant_ready else "degraded",
        environment=settings.environment,
        qdrant_url=settings.qdrant_url,
        qdrant_ready=qdrant_ready,
    )


@app.get("/ready")
async def ready() -> dict[str, bool]:
    """True only when Qdrant is reachable and the collection exists."""
    service: SearchService = app.state.search_service
    if service is None:
        return {"ready": False}
    try:
        await service.ensure_collection()
        return {"ready": service.store.ready()}
    except Exception:
        return {"ready": False}


@app.post("/search/index/sync", response_model=SyncResponse)
async def sync_index() -> SyncResponse:
    service: SearchService = app.state.search_service
    if not service.database_url:
        raise HTTPException(status_code=501, detail="index sync not configured")
    await service.ensure_collection()
    result = await service.sync_index()
    return SyncResponse(**result)


@app.get("/search/status")
async def search_status() -> dict:
    service: SearchService = app.state.search_service
    return await service.status()


@app.post("/search", response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    service: SearchService = app.state.search_service
    try:
        await service.ensure_collection()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"search unavailable: {exc}")
    if not service.store.ready():
        raise HTTPException(status_code=503, detail="search index not ready")
    filters: SearchQuery | None = None
    if payload.filters:
        cleaned = {k: v for k, v in payload.filters.items() if v is not None}
        filters = SearchQuery.model_validate(cleaned)
    try:
        return await service.search(payload.query, filters=filters)
    except Exception as exc:
        logger.exception("search failed")
        raise HTTPException(status_code=500, detail=f"search failed: {exc}")