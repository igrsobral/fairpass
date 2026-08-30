from __future__ import annotations

from fairpass.search.bm25 import SparseVectorizer


def test_fit_is_deterministic() -> None:
    docs = [
        "oasis concert buenos aires",
        "oasis reunion tour",
        "formula one grand prix sao paulo",
    ]
    a = SparseVectorizer().fit(docs)
    b = SparseVectorizer().fit(docs)
    assert a._term_index == b._term_index
    assert a._idf == b._idf


def test_encode_returns_aligned_indices_values() -> None:
    docs = ["oasis concert buenos aires", "coldplay concert leipzig"]
    v = SparseVectorizer().fit(docs)
    indices, values = v.encode("oasis concert")
    assert indices
    assert len(indices) == len(values)
    assert all(indices[i] < indices[i + 1] for i in range(len(indices) - 1))
    assert all(value > 0 for value in values)


def test_encode_unknown_terms_are_ignored() -> None:
    v = SparseVectorizer().fit(["oasis concert buenos aires"])
    indices, values = v.encode("zzzz nothere")
    assert indices == []
    assert values == []


def test_idf_prefers_rare_terms() -> None:
    docs = [
        "oasis oasis oasis tickets",
        "oasis tickets buenos aires",
        "coldplay tickets leipzig",
    ]
    v = SparseVectorizer().fit(docs)
    idx_oasis = v._term_index["oasis"]
    idx_buenos = v._term_index["buenos_aires"] if "buenos_aires" in v._term_index else v._term_index["buenos"]
    assert v._idf[idx_oasis] < v._idf[idx_buenos]


def test_empty_encode_without_fit() -> None:
    v = SparseVectorizer()
    assert v.encode("anything") == ([], [])