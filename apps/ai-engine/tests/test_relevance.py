"""Search relevance suite over the gold set (EVAL-01, deterministic).

Reports MRR and nDCG@k for the query-understanding + retrieval + rerank path
using the deterministic local providers. Phase 2 exit criterion: the suite
reports MRR/nDCG and stays above baseline so later Prompt/agent/rerank changes
are regression-checked.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from fairpass.search.service import SearchService

GOLD_PATH = Path(__file__).parent / "gold" / "search_relevance.jsonl"

METRICS_AT_K = 5
MRR_FLOOR = 0.85
NDCG_FLOOR = 0.75


def load_gold() -> list[dict]:
    rows = []
    with GOLD_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _rrr(relevant: list[str], ranked: list[str], k: int) -> float:
    for i, rid in enumerate(ranked[:k]):
        if rid in relevant:
            return 1.0 / (i + 1)
    return 0.0


def _mrr(scores: list[float]) -> float:
    return sum(scores) / len(scores) if scores else 0.0


def _dcg(scores_binary: list[float], k: int) -> float:
    total = 0.0
    for i in range(min(k, len(scores_binary))):
        rel = scores_binary[i]
        if rel == 0:
            continue
        total += rel / math.log2(i + 2)
    return total


def _ndcg(ranked_ids: list[str], relevant: list[str], k: int) -> float:
    binary = [1.0 if rid in relevant else 0.0 for rid in ranked_ids[:k]]
    ideal = sorted(binary, reverse=True)
    exp = _dcg(binary, k)
    idcg = _dcg(ideal, k)
    return exp / idcg if idcg > 0 else 0.0


def _ranked_ids(response) -> list[str]:
    return [r.listing_id for r in response.results]


async def test_relevance_suite_reports_mrr_and_ndcg(service: SearchService) -> None:
    gold = load_gold()
    assert len(gold) >= 5, "gold set should have at least 5 queries"

    rr = [_rrr(row["relevant"], _ranked_ids(await service.search(row["query"])), METRICS_AT_K) for row in gold]
    ndcg = [_ndcg(_ranked_ids(await service.search(row["query"])), row["relevant"], METRICS_AT_K) for row in gold]

    mrr = _mrr(rr)
    avg_ndcg = sum(ndcg) / len(ndcg)
    print(f"\nsearch relevance: MRR@{METRICS_AT_K}={mrr:.3f} nDCG@{METRICS_AT_K}={avg_ndcg:.3f} "
          f"(gold_queries={len(gold)})")

    assert mrr >= MRR_FLOOR, f"MRR@{METRICS_AT_K} {mrr:.3f} below floor {MRR_FLOOR}"
    assert avg_ndcg >= NDCG_FLOOR, f"nDCG@{METRICS_AT_K} {avg_ndcg:.3f} below floor {NDCG_FLOOR}"