import { searchResponseSchema, type SearchQuery, type SearchResponse } from "../types.js";

const AI_ENGINE_URL = process.env.FAIRPASS_AI_ENGINE_URL ?? "http://localhost:8000";

// The ai-engine (Python) wire format is snake_case; the schema-first tRPC
// contract is camelCase. These two mappers are the only place the shape is
// bridged — zod validation below is the drift detector.

const QUERY_SNAKE: ReadonlyArray<[key: keyof SearchQuery, snake: string]> = [
  ["intent", "intent"],
  ["eventName", "event_name"],
  ["artist", "artist"],
  ["city", "city"],
  ["dateFrom", "date_from"],
  ["dateTo", "date_to"],
  ["quantity", "quantity"],
  ["maxTotalCents", "max_total_cents"],
  ["maxUnitCents", "max_unit_cents"],
  ["tier", "tier"],
  ["category", "category"],
  ["keywords", "keywords"],
];

function toSnakeQuery(filters?: Partial<SearchQuery>): Record<string, unknown> {
  if (!filters) return {};
  const out: Record<string, unknown> = {};
  for (const [key, snake] of QUERY_SNAKE) {
    const value = filters[key];
    if (value !== undefined) out[snake] = value;
  }
  return out;
}

function fromSnakeQuery(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, snake] of QUERY_SNAKE) {
    const value = raw[snake];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

function fromSnakeResult(raw: {
  listing_id?: unknown;
  event_title?: unknown;
  event_date?: unknown;
  city?: unknown;
  section?: unknown;
  row?: unknown;
  seat?: unknown;
  tier?: unknown;
  face_value_cents?: unknown;
  price_cents?: unknown;
  currency?: unknown;
  deviation_pct?: unknown;
  seller_trust_score?: unknown;
  relevance_score?: unknown;
}) {
  return {
    listingId: raw.listing_id,
    eventTitle: raw.event_title,
    eventDate: raw.event_date,
    city: raw.city,
    section: raw.section,
    row: raw.row,
    seat: raw.seat,
    tier: raw.tier,
    faceValueCents: raw.face_value_cents,
    priceCents: raw.price_cents,
    currency: raw.currency,
    deviationPct: raw.deviation_pct,
    sellerTrustScore: raw.seller_trust_score,
    relevanceScore: raw.relevance_score,
  };
}

type AiEngineSearchResponse = {
  query?: Record<string, unknown>;
  results?: Array<Record<string, unknown>>;
  total?: unknown;
};

function fromSnakeResponse(raw: unknown): unknown {
  const body = raw as AiEngineSearchResponse;
  return {
    query: fromSnakeQuery(body.query ?? {}),
    results: (body.results ?? []).map((r) => fromSnakeResult(r)),
    total: body.total,
  };
}

export class SearchUnavailableError extends Error {
  constructor(message = "Search is temporarily unavailable") {
    super(message);
    this.name = "SearchUnavailableError";
  }
}

/**
 * Proxy to the ai-engine hybrid search service. The payload is kept in
 * lockstep with the schema-first contract (searchResponseSchema), so any
 * drift between the Python pipeline and the tRPC/web surface fails loudly.
 */
export async function searchTickets(
  query: string,
  filters?: Partial<SearchQuery>,
): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch(`${AI_ENGINE_URL}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, filters: toSnakeQuery(filters) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SearchUnavailableError();
  }
  if (!response.ok) {
    throw new SearchUnavailableError(
      `Search service returned ${response.status}`,
    );
  }
  const parsed = searchResponseSchema.safeParse(fromSnakeResponse(await response.json()));
  if (!parsed.success) {
    throw new SearchUnavailableError("Search response schema mismatch");
  }
  return parsed.data;
}

export async function syncSearchIndex(): Promise<{
  indexed: number;
  removed_stale: number;
  total: number;
  embedding_provider: string;
  sparse_vocabulary_size: number;
}> {
  let response: Response;
  try {
    response = await fetch(`${AI_ENGINE_URL}/search/index/sync`, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new SearchUnavailableError("Index sync service unreachable");
  }
  if (!response.ok) {
    throw new SearchUnavailableError(
      `Index sync returned ${response.status}`,
    );
  }
  return response.json() as Promise<{
    indexed: number;
    removed_stale: number;
    total: number;
    embedding_provider: string;
    sparse_vocabulary_size: number;
  }>;
}

export async function searchIndexStatus(): Promise<{
  collection: string;
  points: number;
  ready: boolean;
  embedding_provider: string;
  sparse_vocabulary_size: number;
}> {
  try {
    const response = await fetch(`${AI_ENGINE_URL}/search/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error();
    return response.json() as Promise<{
      collection: string;
      points: number;
      ready: boolean;
      embedding_provider: string;
      sparse_vocabulary_size: number;
    }>;
  } catch {
    return { collection: "unknown", points: 0, ready: false, embedding_provider: "unknown", sparse_vocabulary_size: 0 };
  }
}