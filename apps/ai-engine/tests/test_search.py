"""Integration tests: full extraction -> filters -> hybrid retrieval -> rerank."""

from __future__ import annotations

from fairpass.search.service import SearchService


def _ids(response) -> list[str]:
    return [r.listing_id for r in response.results]


async def test_flagship_query_returns_only_honest_result(service: SearchService) -> None:
    response = await service.search(
        "2 lower-tier Oasis tickets in Buenos Aires under $180 total"
    )
    assert response.query.quantity == 2
    assert response.query.max_total_cents == 18000
    assert _ids(response) == ["00000000-0000-4000-8000-00000000000a"]


async def test_budget_filter_is_hard(service: SearchService) -> None:
    response = await service.search("oasis under $100")
    assert response.query.max_unit_cents == 10000
    assert all(r.price_cents <= 10000 for r in response.results)
    assert _ids(response) == ["00000000-0000-4000-8000-00000000000a"]


async def test_city_filter_is_hard(service: SearchService) -> None:
    response = await service.search("premium concert leipzig")
    assert response.query.city == "Leipzig"
    assert all(r.city == "Leipzig" for r in response.results)
    assert set(_ids(response)) == {
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000011",
    }


async def test_tier_filter_is_hard(service: SearchService) -> None:
    response = await service.search("oasis premium seats")
    assert response.query.tier == "premium"
    assert all(r.tier == "premium" for r in response.results)


async def test_rerank_promotes_honest_listing_ahead_of_scalper(
    service: SearchService,
) -> None:
    response = await service.search("coldplay premium")
    ids = _ids(response)
    assert ids[0] == "00000000-0000-4000-8000-000000000010"  # trusted, +10%
    assert response.results[0].deviation_pct < response.results[1].deviation_pct


async def test_rerank_puts_honest_oasis_first_despite_lower_relevance(
    service: SearchService,
) -> None:
    response = await service.search("oasis buenos aires")
    ids = _ids(response)
    hero = [r for r in response.results if r.listing_id ==
            "00000000-0000-4000-8000-00000000000a"][0]
    scalper = [r for r in response.results if r.listing_id ==
               "00000000-0000-4000-8000-00000000000d"][0]
    assert ids[0] == hero.listing_id
    # Scalper had higher raw relevance; honesty+trust inverted the order.
    assert scalper.relevance_score > hero.relevance_score
    assert hero.seller_trust_score > scalper.seller_trust_score


async def test_sports_query_targets_inter_miami(service: SearchService) -> None:
    response = await service.search("inter miami match buenos aires")
    assert response.query.category == "sports"
    assert _ids(response)[0] == "00000000-0000-4000-8000-000000000012"


async def test_past_events_are_excluded(service: SearchService) -> None:
    # Catalog dates are all in the future; a 'now' far in the future must
    # satisfy the always-open filter and return nothing.
    import datetime

    far_future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=365
    )
    response = await service.search(
        "oasis concert", now=far_future
    )
    assert response.results == []


async def test_no_signal_query_returns_empty(service: SearchService) -> None:
    response = await service.search("aaa aaa aaa")
    assert response.results == []


async def test_results_are_shape_valid(service: SearchService) -> None:
    response = await service.search("concert")
    for result in response.results:
        assert result.face_value_cents > 0
        assert result.price_cents > 0
        assert 0.0 <= result.relevance_score <= 1.0
        assert 0.0 <= result.seller_trust_score <= 1.0
        assert result.currency == "USD"