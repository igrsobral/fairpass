import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { eventDates, events, venues, ticketListings } from "../db/schema/index.js";
import type { TicketListing } from "../db/schema/index.js";
import { db } from "../db/client.js";
import { recomputeTrust } from "./sellers.js";

export class ListingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingError";
  }
}

export const TIERS = ["premium", "standard", "budget"] as const;
export type Tier = (typeof TIERS)[number] | string;

export interface CreateListingInput {
  sellerId: string;
  eventDateId: string;
  section?: string | null;
  row?: string | null;
  seat?: string | null;
  tier: Tier;
  faceValueCents: number;
  priceCents: number;
  currency?: string;
  barcode?: string | null;
}

function barcodeSha256(barcode: string | null): string | null {
  const trimmed = barcode?.trim();
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
}

export async function createListing(
  input: CreateListingInput,
): Promise<TicketListing> {
  if (input.faceValueCents < 1 || input.priceCents < 1) {
    throw new ListingError("Face value and price must be at least $0.01");
  }

  const [date] = await db
    .select()
    .from(eventDates)
    .where(
      and(
        eq(eventDates.id, input.eventDateId),
        eq(eventDates.status, "on_sale"),
        gte(eventDates.startsAt, new Date()),
      ),
    )
    .limit(1);
  if (!date) {
    throw new ListingError("Event date not found or no longer on sale");
  }

  const hash = barcodeSha256(input.barcode ?? null);
  const [listing] = await db
    .insert(ticketListings)
    .values({
      sellerId: input.sellerId,
      eventDateId: input.eventDateId,
      section: input.section ?? null,
      row: input.row ?? null,
      seat: input.seat ?? null,
      tier: input.tier,
      faceValueCents: input.faceValueCents,
      priceCents: input.priceCents,
      currency: input.currency ?? "USD",
      status: "active",
      barcodeSha256: hash,
      verificationStatus: hash ? "pending" : "pending",
    })
    .returning();
  if (!listing) throw new ListingError("Failed to create listing");
  return listing;
}

export async function cancelListing(
  listingId: string,
  sellerId: string,
): Promise<TicketListing> {
  const [listing] = await db
    .select()
    .from(ticketListings)
    .where(eq(ticketListings.id, listingId))
    .limit(1);
  if (!listing) throw new ListingError("Listing not found");
  if (listing.sellerId !== sellerId) {
    throw new ListingError("You can only cancel your own listings");
  }
  if (listing.status !== "active") {
    throw new ListingError("Only active listings can be cancelled");
  }
  const [updated] = await db
    .update(ticketListings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(ticketListings.id, listingId))
    .returning();
  return updated as TicketListing;
}

export async function listMyListings(
  sellerId: string,
): Promise<TicketListing[]> {
  return db
    .select()
    .from(ticketListings)
    .where(eq(ticketListings.sellerId, sellerId))
    .orderBy(desc(ticketListings.createdAt));
}

export interface ListingResultRow {
  listing: TicketListing;
  eventTitle: string;
  eventDate: Date;
  city: string | null;
  deviationPct: number;
  sellerTrustScore: number;
}

export async function listActiveForEventDate(
  eventDateId: string,
): Promise<ListingResultRow[]> {
  const rows = await db
    .select({
      listing: ticketListings,
      eventTitle: events.title,
      eventDate: eventDates.startsAt,
      city: venues.city,
    })
    .from(ticketListings)
    .innerJoin(eventDates, eq(ticketListings.eventDateId, eventDates.id))
    .innerJoin(events, eq(eventDates.eventId, events.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(
      and(
        eq(ticketListings.eventDateId, eventDateId),
        eq(ticketListings.status, "active"),
      ),
    )
    .orderBy(asc(ticketListings.priceCents));

  const sellers = new Set(rows.map((r) => r.listing.sellerId));
  const trustMap = new Map<string, number>();
  for (const sellerId of sellers) {
    trustMap.set(sellerId, await recomputeTrust(sellerId));
  }

  return rows.map((r) => {
    const face = r.listing.faceValueCents;
    const price = r.listing.priceCents;
    const deviationPct = face > 0 ? ((price - face) / face) * 100 : 0;
    return {
      listing: r.listing,
      eventTitle: r.eventTitle,
      eventDate: r.eventDate,
      city: r.city,
      deviationPct: Math.round(deviationPct * 100) / 100,
      sellerTrustScore: trustMap.get(r.listing.sellerId) ?? 0,
    };
  });
}