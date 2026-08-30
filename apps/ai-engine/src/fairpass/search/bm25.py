"""Offline BM25 sparse vectorizer (deterministic).

Encodes text into a sparse vector of ``{index, value}`` terms suitable for
Qdrant's named sparse vectors. ``fit`` builds an idf vocabulary from the
indexed corpus so query and document use the same weights. Rebuilt on every
index sync (corpus = all currently indexed listing documents).
"""

from __future__ import annotations

import math
import re

EPSILON = 1e-9


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    shingles: list[str] = list(words)
    shingles += [f"{a}_{b}" for a, b in zip(words, words[1:])]
    return shingles


class SparseVectorizer:
    def __init__(self, k1: float = 1.2, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._term_index: dict[str, int] = {}
        self._idf: list[float] = []
        self._avgdl = 0.0

    def fit(self, documents: list[str]) -> "SparseVectorizer":
        """Build term vocabulary + idf from the corpus documents."""
        doc_freq: dict[str, int] = {}
        doc_lens: list[int] = []
        for doc in documents:
            tokens = _tokens(doc)
            doc_lens.append(len(tokens))
            for term in set(tokens):
                doc_freq[term] = doc_freq.get(term, 0) + 1
        n = max(len(documents), 1)
        self._avgdl = (sum(doc_lens) / n) if n else 0.0
        vocabulary = sorted(doc_freq)
        self._term_index = {term: i for i, term in enumerate(vocabulary)}
        self._idf = [
            math.log(1.0 + (n - doc_freq[term]) / (doc_freq[term] + 0.5))
            for term in vocabulary
        ]
        return self

    def encode(self, text: str) -> tuple[list[int], list[float]]:
        """Return (indices, values) with BM25-ized term weights."""
        from collections import Counter

        tokens = _tokens(text)
        if not tokens or not self._term_index:
            return [], []
        counts = Counter(tokens)
        doc_len = len(tokens)
        norm = (self._avgdl or 1.0) / max(doc_len, 1) if self._avgdl else 1.0
        indices: list[int] = []
        values: list[float] = []
        for term, tf in counts.items():
            idx = self._term_index.get(term)
            if idx is None:
                continue
            denom = tf + self.k1 * (1.0 - self.b + self.b * norm)
            value = self._idf[idx] * (tf * (self.k1 + 1.0)) / (denom + EPSILON)
            if value > EPSILON:
                indices.append(idx)
                values.append(value)
        return indices, values

    @property
    def vocabulary_size(self) -> int:
        return len(self._term_index)