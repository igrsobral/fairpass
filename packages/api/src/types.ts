import { z } from "zod";

/**
 * Schema-first contract for natural-language query understanding.
 * Shared by:
 *  - the hybrid search pipeline (query -> structured filters + vector query)
 *  - the matchmaking agent's `search_tickets` tool
 *  - smart alerts (persisted as `smart_alerts.filters`)
 *  - the eval harness (gold datasets assert on these fields)
 *
 * Keep this schema the single source of truth. Any new extractable
 * concept (e.g. "accessible seating") is added here first, then wired
 * through search, agent prompts, and eval gold data.
 */
export const searchQuerySchema = z.object({
  intent: z.enum(["buy", "sell", "alert", "info"]).default("buy"),
  eventName: z.string().optional(),
  artist: z.string().optional(),
  city: z.string().optional(),
  dateFrom: z.string().optional(), // ISO date
  dateTo: z.string().optional(), // ISO date
  quantity: z.number().int().positive().max(8).default(1),
  maxTotalCents: z.number().int().positive().optional(), // e.g. "$180 total"
  maxUnitCents: z.number().int().positive().optional(),
  tier: z.enum(["premium", "standard", "budget"]).optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(), // fuzzy/semantic descriptors
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const listingResultSchema = z.object({
  listingId: z.string(),
  eventTitle: z.string(),
  eventDate: z.string(),
  city: z.string(),
  section: z.string().nullable(),
  row: z.string().nullable(),
  seat: z.string().nullable(),
  tier: z.string(),
  faceValueCents: z.number(),
  priceCents: z.number(),
  currency: z.string(),
  deviationPct: z.number(), // (price - face) / face * 100
  sellerTrustScore: z.number(),
  relevanceScore: z.number(), // 0..1 fused retrieval score
});

export type ListingResult = z.infer<typeof listingResultSchema>;

export const searchResponseSchema = z.object({
  query: searchQuerySchema,
  results: z.array(listingResultSchema).max(20),
  total: z.number().int().nonnegative(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const smartAlertTriggerSchema = z.object({
  alertId: z.string(),
  listingId: z.string(),
  matchReason: z.string(),
});