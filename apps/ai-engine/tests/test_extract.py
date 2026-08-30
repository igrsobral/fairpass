from __future__ import annotations

from fairpass.search.extract import LocalQueryExtractor

VOCAB = {
    "city": {"Buenos Aires", "São Paulo", "Dublin", "Leipzig"},
    "event_title": {
        "Oasis Live '26",
        "F1 São Paulo Grand Prix",
        "Inter Miami cf. River Plate",
        "Taylor Swift: The Eras Tour",
        "Coldplay: Music of the Spheres",
    },
    "artist": {"Oasis", "Taylor Swift", "Coldplay"},
    "category": {"concert", "sports"},
}


async def extract_one(text: str) -> dict:
    extractor = LocalQueryExtractor()
    return (await extractor.extract(text, vocab=VOCAB)).model_dump(exclude_none=True)


def _clean(d: dict) -> dict:
    d.pop("keywords", None)
    return d


async def test_flagship_query_parses_everything() -> None:
    result = _clean(
        await extract_one(
            "2 lower-tier Oasis tickets in Buenos Aires under $180 total"
        )
    )
    assert result == {
        "intent": "buy",
        "artist": "Oasis",
        "city": "Buenos Aires",
        "max_total_cents": 18000,
        "quantity": 2,
        "tier": "budget",
    }


async def test_bare_amount_without_dollar_sign_is_a_budget() -> None:
    result = _clean(await extract_one("eras tour tickets under 200"))
    assert result["max_unit_cents"] == 20000
    assert "max_total_cents" not in result


async def test_total_budget_beats_unit_for_pairs() -> None:
    result = _clean(await extract_one("2 oasis tickets for $180 total"))
    assert result["max_total_cents"] == 18000
    assert result["quantity"] == 2
    assert "max_unit_cents" not in result


async def test_unit_cue_wins() -> None:
    result = _clean(await extract_one("oasis ticket $100 each"))
    assert result["max_unit_cents"] == 10000
    assert "max_total_cents" not in result


async def test_event_name_and_artist_detection() -> None:
    result = _clean(await extract_one("Taylor Swift Eras Tour in Dublin"))
    assert result["event_name"] == "Taylor Swift: The Eras Tour"
    assert result["artist"] == "Taylor Swift"
    assert result["city"] == "Dublin"


async def test_sports_category_mapping() -> None:
    result = _clean(await extract_one("inter miami match in Buenos Aires"))
    assert result["category"] == "sports"
    assert result["city"] == "Buenos Aires"


async def test_alert_intent() -> None:
    result = _clean(await extract_one("alert me when Oasis tickets drop under $150"))
    assert result["intent"] == "alert"
    assert result["artist"] == "Oasis"
    assert result["max_unit_cents"] == 15000


async def test_quantity_is_capped() -> None:
    result = _clean(await extract_one("9 tickets for coldplay"))
    assert result["quantity"] == 8


async def test_unrelated_query_stays_defaults() -> None:
    result = _clean(await extract_one("hello world"))
    assert result == {"intent": "buy", "quantity": 1}