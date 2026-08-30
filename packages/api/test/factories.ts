import { eventDates, events, sellerTrustScores, venues } from "../src/db/schema/index.js";
import type { Event, EventDate, User, Venue } from "../src/db/schema/index.js";
import { db } from "../src/db/client.js";
import { registerUser } from "../src/services/auth.js";
import { createListing } from "../src/services/listings.js";
import { eq } from "drizzle-orm";

let counter = 0;

export const DAY_MS = 86_400_000;

export function futureDate(days = 30): Date {
  return new Date(Date.now() + days * DAY_MS);
}

export async function makeUser(): Promise<User> {
  counter += 1;
  return registerUser({
    email: `user${counter}@example.com`,
    name: `Test User ${counter}`,
    password: "password123",
  });
}

export async function makeVenue(name = "Test Arena"): Promise<Venue> {
  const [venue] = await db
    .insert(venues)
    .values({
      name,
      city: "Test City",
      country: "AR",
      timezone: "America/Argentina/Buenos_Aires",
    })
    .returning();
  if (!venue) throw new Error("failed to create venue");
  return venue;
}

export async function makeEvent(
  venueId: string,
  title = "Test Concert",
  category = "concert",
): Promise<Event> {
  const [event] = await db
    .insert(events)
    .values({ venueId, title, category, artist: "Test Artist" })
    .returning();
  if (!event) throw new Error("failed to create event");
  return event;
}

export async function makeEventDate(
  eventId: string,
  startsAt: Date = futureDate(30),
  status = "on_sale",
): Promise<EventDate> {
  const [date] = await db
    .insert(eventDates)
    .values({ eventId, startsAt, doorsAt: new Date(startsAt.getTime() - 60 * 60_000), status })
    .returning();
  if (!date) throw new Error("failed to create event date");
  return date;
}

export async function makeListing(opts: {
  sellerId: string;
  eventDateId: string;
  faceValueCents?: number;
  priceCents?: number;
  tier?: "premium" | "standard" | "budget";
  barcode?: string | null;
  section?: string | null;
  row?: string | null;
  seat?: string | null;
}) {
  return createListing({
    sellerId: opts.sellerId,
    eventDateId: opts.eventDateId,
    faceValueCents: opts.faceValueCents ?? 10_000,
    priceCents: opts.priceCents ?? 11_500,
    tier: opts.tier ?? "standard",
    barcode: opts.barcode ?? null,
    section: opts.section ?? null,
    row: opts.row ?? null,
    seat: opts.seat ?? null,
  });
}

export async function getSellerTrust(sellerId: string): Promise<number | null> {
  const [row] = await db
    .select({ score: sellerTrustScores.score })
    .from(sellerTrustScores)
    .where(eq(sellerTrustScores.sellerId, sellerId))
    .limit(1);
  return row?.score ?? null;
}