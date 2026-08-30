from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime configuration for the AI engine.

    Values come from environment variables (FAIRPASS_* / standard *_URL).
    """

    app_name: str = "fairpass-ai-engine"
    environment: str = "development"

    database_url: str = "postgres://fairpass:fairpass@localhost:5433/fairpass"
    redis_url: str = "redis://localhost:6380"
    qdrant_url: str = "http://localhost:6335"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    qdrant_collection: str = "ticket_listings"

    # "local" = deterministic offline providers (CI/tests/demo without secrets).
    # "openai" = text-embedding-3-small + gpt-4o-mini function-call extraction.
    embedding_provider: str = "local"
    query_extractor: str = "local"

    model_config = {"env_prefix": "FAIRPASS_"}


settings = Settings()