"""Embedding providers behind one protocol.

``LocalEmbedder`` is a deterministic, dependency-free vectorizer (hash n-gram
bag-of-words) used for offline development, tests and CI. ``OpenAIEmbedder``
uses ``text-embedding-3-small`` when ``FAIRPASS_OPENAI_API_KEY`` is set. The
collection width is fixed at creation time, so the provider must be stable for
the lifetime of a Qdrant collection.
"""

from __future__ import annotations

import hashlib
import re
from abc import ABC, abstractmethod
from collections import Counter

DIMS_LOCAL = 256
DIMS_OPENAI = 1536  # text-embedding-3-small


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    shingles: list[str] = list(words)
    shingles += [f"{a}_{b}" for a, b in zip(words, words[1:])]
    return shingles


class Embedder(ABC):
    dimensions: int
    # True when the provider can match out-of-vocabulary terms semantically
    # (dense-only retrieval is meaningful); False for the bag-of-words fallback.
    semantic: bool = False

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...

    async def embed(self, text: str) -> list[float]:
        return (await self.embed_batch([text]))[0]


class LocalEmbedder(Embedder):
    """Deterministic hash n-gram bag-of-words, L2-normalized."""

    dimensions = DIMS_LOCAL

    def __init__(self, dimensions: int = DIMS_LOCAL) -> None:
        self.dimensions = dimensions

    @staticmethod
    def _hash_index(token: str, dims: int) -> int:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        return int.from_bytes(digest[:4], "little") % dims

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            counts = Counter(_tokens(text))
            vec = [0.0] * self.dimensions
            for token, tf in counts.items():
                idx = self._hash_index(token, self.dimensions)
                vec[idx] += 1.0 + tf * 0.25
            norm = (sum(v * v for v in vec) ** 0.5) or 1.0
            vectors.append([v / norm for v in vec])
        return vectors


class OpenAIEmbedder(Embedder):
    """text-embedding-3-small via the official ``openai`` client."""

    dimensions = DIMS_OPENAI
    semantic = True

    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(
            model=self.model,
            input=texts,
            encoding_format="float",
        )
        return [item.embedding for item in response.data]


def make_embedder(provider: str, api_key: str = "", model: str = "") -> Embedder:
    if provider == "openai":
        if not api_key:
            raise ValueError(
                "FAIRPASS_OPENAI_API_KEY is required when FAIRPASS_EMBEDDING_PROVIDER=openai"
            )
        return OpenAIEmbedder(api_key, model or "text-embedding-3-small")
    return LocalEmbedder()