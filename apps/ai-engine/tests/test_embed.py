from __future__ import annotations

from fairpass.search.embed import LocalEmbedder


async def test_local_embedder_is_deterministic() -> None:
    embedder = LocalEmbedder()
    a = await embedder.embed("oasis tickets buenos aires")
    b = await embedder.embed("oasis tickets buenos aires")
    assert a == b


async def test_local_embedder_dimensions_and_norm() -> None:
    embedder = LocalEmbedder()
    vector = await embedder.embed("two lower tier oasis tickets")
    assert len(vector) == embedder.dimensions == 256
    norm = sum(v * v for v in vector) ** 0.5
    assert abs(norm - 1.0) < 1e-6


async def test_local_embedder_empty_text_still_returns_unit_vector() -> None:
    embedder = LocalEmbedder()
    vector = await embedder.embed("")
    assert len(vector) == 256
    assert all(v == 0.0 for v in vector)


async def test_local_embedder_similar_texts_closer_than_dissimilar() -> None:
    embedder = LocalEmbedder()
    oasis = await embedder.embed("oasis concert buenos aires")
    oasis_again = await embedder.embed("oasis show buenos aires")
    f1 = await embedder.embed("formula one grand prix sao paulo")
    dot_same = sum(a * b for a, b in zip(oasis, oasis_again))
    dot_diff = sum(a * b for a, b in zip(oasis, f1))
    assert dot_same > dot_diff