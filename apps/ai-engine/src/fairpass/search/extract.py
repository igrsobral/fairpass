"""Natural-language query understanding.

Two providers behind one protocol:

- ``OpenAIQueryExtractor`` — function-call (strict structured output) against
  the ``searchQuerySchema`` JSON schema when ``FAIRPASS_OPENAI_API_KEY`` is set.
- ``LocalQueryExtractor`` — deterministic rule-based fallback used for
  offline dev, CI and evals.

Both return a ``SearchQuery`` validated by the pydantic mirror of the shared
schema, so the extraction contract can never drift from the filter/agent/tool
surface.
"""

from __future__ import annotations

import json
import re
import unicodedata
from abc import ABC, abstractmethod
from typing import Any

from fairpass.search.schemas import SearchQuery

TIER_MAP = {
    "lower": "budget",
    "upper": "premium",
    "premium": "premium",
    "vip": "premium",
    "front": "premium",
    "best": "premium",
    "standard": "standard",
    "general": "budget",
    "ga": "budget",
    "cheap": "budget",
    "cheapest": "budget",
    "budget": "budget",
    "obstructed": "budget",
}

CATEGORY_WORDS = {
    "concert": "concert",
    "gig": "concert",
    "show": "concert",
    "tour": "concert",
    "game": "sports",
    "match": "sports",
    "race": "sports",
    "sport": "sports",
    "football": "sports",
    "soccer": "sports",
    "formula": "sports",
}

STOPWORDS = {
    "i", "me", "my", "we", "our", "a", "an", "the", "for", "and", "or",
    "in", "on", "at", "to", "of", "under", "below", "less", "than", "over",
    "about", "is", "are", "were", "ticket", "tickets", "seat", "seats",
    "looking", "want", "would", "need", "buy", "two", "one", "three",
    "tier", "each", "per", "total", "please", "any", "beyond", "for",
}

TITLE_TITLE_STOPWORDS = STOPWORDS | {"live", "the", "tour", "music", "cf", "26"}


def _significant_words(text: str) -> list[str]:
    """Normalize a title/query into significant tokens (accents stripped)."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return [
        token
        for token in re.findall(r"[a-z0-9]+", ascii_text)
        if token not in TITLE_TITLE_STOPWORDS and token.isalpha()
    ]


def _best_event_match(lower_query: str, events: set[str]) -> str | None:
    """Match an event title when ALL its significant words appear in the query.

    Requires >=2 significant words to avoid single-word false positives
    ("oasis" alone won't claim "Oasis Live '26").
    """
    best: str | None = None
    best_words: list[str] = []
    for title in events:
        sig = _significant_words(title)
        if len(sig) < 2:
            continue
        if all(word in lower_query for word in sig):
            if len(sig) > len(best_words):
                best = title
                best_words = sig
    return best


class QueryExtractor(ABC):
    @abstractmethod
    async def extract(self, text: str, *, vocab: dict[str, set[str]]) -> SearchQuery: ...


class LocalQueryExtractor(QueryExtractor):
    """Deterministic rule-based extraction (offline / CI / evals)."""

    @staticmethod
    def _find_quantity(lower: str) -> int | None:
        tokens = lower.split()
        for i, token in enumerate(tokens):
            if token in {"ticket", "tickets", "seat", "seats", "tix"}:
                for back in range(max(0, i - 8), i):
                    if re.fullmatch(r"\d+", tokens[back]):
                        return int(tokens[back])
        m = re.search(r"[x×]\s*(\d+)\b", lower)
        if m:
            return int(m.group(1))
        return None

    async def extract(self, text: str, *, vocab: dict[str, set[str]]) -> SearchQuery:
        lower = text.lower()
        query = SearchQuery(intent="buy", quantity=1)

        query.intent = "alert" if re.search(
            r"\b(alert|notify|watch|let me know|when.*available)\b", lower
        ) else "sell" if re.search(
            r"\b(sell|selling|list my|post)\b", lower
        ) else "buy"

        cities = vocab.get("city", set())
        for city in cities:
            if city.lower() in lower:
                query.city = city
                break
        query.event_name = _best_event_match(lower, vocab.get("event_title", set()))
        for artist in vocab.get("artist", set()):
            if artist.lower() in lower:
                query.artist = artist
                break
        for category in vocab.get("category", set()):
            if category.lower() in lower:
                query.category = category
                break
        for word, category in CATEGORY_WORDS.items():
            if word in lower:
                query.category = query.category or category

        for tier_name, tier_value in TIER_MAP.items():
            if re.search(rf"\b{tier_name}\b", lower):
                query.tier = tier_value
                break

        m_qty = self._find_quantity(lower)
        if m_qty:
            query.quantity = min(m_qty, 8)

        money_cents = None
        m_money = re.search(r"\$\s?(\d+(?:\.\d{2})?)|\b(?:under|below|less than|max|budget|cap)\s+(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:usd|dollars)", lower)
        if m_money:
            raw = next(g for g in m_money.groups() if g)
            money_cents = int(round(float(raw) * 100))
        if money_cents is not None:
            has_total_cue = bool(re.search(
                r"\b(total|for (both|the (two|three)|all))\b|(?:\bfor\b.*\btickets?\b)",
                lower,
            )) or query.quantity > 1
            has_unit_cue = bool(re.search(r"\bper\b|\beach\b|each ticket", lower))
            if has_total_cue and not has_unit_cue:
                query.max_total_cents = money_cents
            else:
                query.max_unit_cents = money_cents

        m_date = re.search(r"\b(2\d{3})-(\d{2})-(\d{2})\b", text)
        if m_date:
            query.date_from = f"{m_date.group(1)}-{m_date.group(2)}-{m_date.group(3)}"
            query.date_to = query.date_from

        kept: list[str] = []
        for token in re.findall(r"[a-z0-9]+", lower):
            if len(token) < 3 or token in STOPWORDS:
                continue
            if m_money and token in {"usd", "dollars"}:
                continue
            if token not in kept:
                kept.append(token)
        if kept:
            query.keywords = kept

        return query


class OpenAIQueryExtractor(QueryExtractor):
    """Structured output via function calling against the shared schema."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self.model = model

    def _json_schema(self) -> dict[str, Any]:
        properties = {
            "intent": {"type": "string", "enum": ["buy", "sell", "alert", "info"]},
            "event_name": {"type": "string"},
            "artist": {"type": "string"},
            "city": {"type": "string"},
            "date_from": {"type": "string"},
            "date_to": {"type": "string"},
            "quantity": {"type": "integer", "minimum": 1, "maximum": 8},
            "max_total_cents": {"type": "integer"},
            "max_unit_cents": {"type": "integer"},
            "tier": {"type": "string", "enum": ["premium", "standard", "budget"]},
            "category": {"type": "string"},
            "keywords": {"type": "array", "items": {"type": "string"}},
        }
        return {
            "type": "object",
            "properties": properties,
            "required": ["intent", "quantity"],
            "additionalProperties": False,
        }

    async def extract(self, text: str, *, vocab: dict[str, set[str]]) -> SearchQuery:
        system = (
            "You extract structured ticket-search queries from natural language. "
            "Money is in integer cents. Lower-tier seating maps to the 'standard' "
            "tier. If explicit values are absent, return defaults."
        )
        completion = await self._client.chat.completions.create(
            model=self.model,
            temperature=0,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "parse_search_query",
                        "description": "Parse a ticket-search request into a structured query.",
                        "parameters": self._json_schema(),
                        "strict": True,
                    },
                }
            ],
            tool_choice={
                "type": "function",
                "function": {"name": "parse_search_query"},
            },
        )
        raw = json.loads(
            completion.choices[0].message.tool_calls[0].function.arguments
        )
        return SearchQuery.model_validate(raw)


def make_extractor(provider: str, api_key: str = "", model: str = "") -> QueryExtractor:
    if provider == "openai":
        if not api_key:
            raise ValueError(
                "FAIRPASS_OPENAI_API_KEY is required when FAIRPASS_QUERY_EXTRACTOR=openai"
            )
        return OpenAIQueryExtractor(api_key, model or "gpt-4o-mini")
    return LocalQueryExtractor()