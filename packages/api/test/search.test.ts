import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SearchUnavailableError,
  searchIndexStatus,
  searchTickets,
  syncSearchIndex,
} from "../src/services/search.js";

const SNAKE_RESPONSE = {
  query: {
    intent: "buy",
    event_name: null,
    artist: "Oasis",
    city: "Buenos Aires",
    date_from: null,
    date_to: null,
    quantity: 2,
    max_total_cents: 18000,
    max_unit_cents: null,
    tier: "budget",
    category: null,
    keywords: ["oasis"],
  },
  results: [
    {
      listing_id: "00000000-0000-4000-8000-00000000000a",
      event_title: "Oasis Live '26",
      event_date: "2026-10-13T20:00:00+00:00",
      city: "Buenos Aires",
      section: "Campo",
      row: "GA",
      seat: "..",
      tier: "budget",
      face_value_cents: 9000,
      price_cents: 9000,
      currency: "USD",
      deviation_pct: 0,
      seller_trust_score: 0.86,
      relevance_score: 1,
    },
  ],
  total: 1,
};

function stubFetch(status: number, body: unknown, init?: ResponseInit): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
        ...init,
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchTickets", () => {
  it("translates snake_case ai-engine payloads into the camelCase contract", async () => {
    stubFetch(200, SNAKE_RESPONSE);
    const result = await searchTickets(
      "2 lower-tier oasis tickets in buenos aires under 180 total",
    );
    expect(result).toMatchObject({
      query: {
        artist: "Oasis",
        city: "Buenos Aires",
        quantity: 2,
        maxTotalCents: 18000,
        tier: "budget",
        keywords: ["oasis"],
      },
      total: 1,
    });
    expect(result.results[0]).toMatchObject({
      listingId: "00000000-0000-4000-8000-00000000000a",
      eventTitle: "Oasis Live '26",
      faceValueCents: 9000,
      priceCents: 9000,
      sellerTrustScore: 0.86,
      relevanceScore: 1,
    });
    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.query).toBe(
      "2 lower-tier oasis tickets in buenos aires under 180 total",
    );
  });

  it("sends camelCase filters translated to snake_case", async () => {
    stubFetch(200, SNAKE_RESPONSE);
    await searchTickets("oasis", {
      maxTotalCents: 10000,
      tier: "budget",
    });
    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.filters).toEqual({
      max_total_cents: 10000,
      tier: "budget",
    });
  });

  it("throws SearchUnavailableError when the engine is down", async () => {
    stubFetch(200, SNAKE_RESPONSE, { status: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(searchTickets("oasis")).rejects.toThrow(SearchUnavailableError);
  });

  it("throws SearchUnavailableError on non-200", async () => {
    stubFetch(502, { detail: "upstream error" });
    await expect(searchTickets("oasis")).rejects.toThrow(SearchUnavailableError);
  });

  it("throws SearchUnavailableError on contract drift", async () => {
    stubFetch(200, { query: {}, results: [{ wat: 1 }], total: "nope" });
    await expect(searchTickets("oasis")).rejects.toThrow(/schema mismatch/);
  });
});

describe("syncSearchIndex / searchIndexStatus", () => {
  it("returns sync counters", async () => {
    stubFetch(200, {
      indexed: 10,
      removed_stale: 1,
      total: 13,
      embedding_provider: "local",
      sparse_vocabulary_size: 241,
    });
    const sync = await syncSearchIndex();
    expect(sync.indexed).toBe(10);
    expect(sync.embedding_provider).toBe("local");
  });

  it("returns a degraded status object when the engine is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const status = await searchIndexStatus();
    expect(status).toEqual({
      collection: "unknown",
      points: 0,
      ready: false,
      embedding_provider: "unknown",
      sparse_vocabulary_size: 0,
    });
  });
});