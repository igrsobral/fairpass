import { createHash } from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db/client.js";
import { users, venues, events, eventDates, ticketListings, orders, sellerTrustScores } from "../src/db/schema/index.js";
import type { User } from "../src/db/schema/index.js";
import { registerUser } from "../src/services/auth.js";
import { recomputeTrust } from "../src/services/sellers.js";

interface SeedUser {
  email: string;
  name: string;
  password: string;
}

const BUYER: SeedUser = { email: "buyer@fairpass.dev", name: "Camila Buyer", password: "password123" };
const SELLERS: SeedUser[] = [
  { email: "trusted@fairpass.dev", name: "Martín Trusted", password: "password123" },
  { email: "casual@fairpass.dev", name: "Lucía Casual", password: "password123" },
  { email: "scalper@fairpass.dev", name: "Leo Scalper", password: "password123" },
  { email: "sketchy@fairpass.dev", name: "Nico Sketchy", password: "password123" },
];

interface VenueSeed {
  name: string;
  city: string;
  country: string;
  timezone: string;
}

const VENUES: VenueSeed[] = [
  { name: "Movistar Arena", city: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" },
  { name: "Estadio Más Monumental", city: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" },
  { name: "Autódromo José Carlos Pace", city: "São Paulo", country: "BR", timezone: "America/Sao_Paulo" },
  { name: "Aviva Stadium", city: "Dublin", country: "IE", timezone: "Europe/Dublin" },
  { name: "Red Bull Arena", city: "Leipzig", country: "DE", timezone: "Europe/Berlin" },
];

interface EventSeed {
  title: string;
  category: string;
  artist: string | null;
  venue: string;
  description: string;
  dates: { daysFromNow: number; doors: string }[];
}

const EVENTS: EventSeed[] = [
  {
    title: "Oasis Live '26",
    category: "concert",
    artist: "Oasis",
    venue: "Movistar Arena",
    description: "Reunion tour — Buenos Aires night one.",
    dates: [
      { daysFromNow: 47, doors: "19:30" },
      { daysFromNow: 49, doors: "19:30" },
    ],
  },
  {
    title: "F1 São Paulo Grand Prix",
    category: "sports",
    artist: null,
    venue: "Autódromo José Carlos Pace",
    description: "Formula 1 Brazilian Grand Prix race day.",
    dates: [{ daysFromNow: 86, doors: "09:00" }],
  },
  {
    title: "Inter Miami cf. River Plate",
    category: "sports",
    artist: null,
    venue: "Estadio Más Monumental",
    description: "International friendly — Messi expected to start.",
    dates: [{ daysFromNow: 23, doors: "19:00" }],
  },
  {
    title: "Taylor Swift: The Eras Tour",
    category: "concert",
    artist: "Taylor Swift",
    venue: "Aviva Stadium",
    description: "Extra Dublin date added by demand.",
    dates: [{ daysFromNow: 62, doors: "17:00" }],
  },
  {
    title: "Coldplay: Music of the Spheres",
    category: "concert",
    artist: "Coldplay",
    venue: "Red Bull Arena",
    description: "European leg of the world tour.",
    dates: [{ daysFromNow: 34, doors: "18:30" }],
  },
];

function ean13(): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return [...digits, check].join("");
}

interface ListingSeed {
  seller: number; // index into SELLERS
  event: number; // index into EVENTS
  date: number; // index into the event's dates
  section: string;
  row: string;
  seat: string;
  tier: "premium" | "standard" | "budget";
  faceValueCents: number;
  priceCents: number;
}

const LISTINGS: ListingSeed[] = [
  // Trusted seller — near-face-price inventory across events.
  { seller: 0, event: 0, date: 0, section: "Campo", row: "GA", seat: "..", tier: "budget", faceValueCents: 9_000, priceCents: 9_000 },
  { seller: 0, event: 0, date: 0, section: "Platea Baja", row: "9", seat: "12", tier: "standard", faceValueCents: 14_000, priceCents: 16_800 },
  { seller: 0, event: 1, date: 0, section: "Tribuna A", row: "14", seat: "87", tier: "standard", faceValueCents: 18_000, priceCents: 19_800 },
  { seller: 0, event: 2, date: 0, section: "Sívori", row: "7", seat: "104", tier: "standard", faceValueCents: 12_000, priceCents: 13_200 },
  { seller: 0, event: 4, date: 0, section: "Oberrang", row: "12", seat: "3", tier: "premium", faceValueCents: 16_000, priceCents: 17_600 },
  // Casual seller — modest markups.
  { seller: 1, event: 0, date: 1, section: "Campo", row: "GA", seat: "..", tier: "budget", faceValueCents: 9_000, priceCents: 13_500 },
  { seller: 1, event: 3, date: 0, section: "D 200", row: "H", seat: "47", tier: "standard", faceValueCents: 22_000, priceCents: 33_000 },
  { seller: 1, event: 2, date: 0, section: "Sívori", row: "21", seat: "66", tier: "budget", faceValueCents: 12_000, priceCents: 16_800 },
  // Scalper — heavy markups, no completed sales.
  { seller: 2, event: 0, date: 0, section: "Platea Alta", row: "5", seat: "21", tier: "standard", faceValueCents: 9_000, priceCents: 36_000 },
  { seller: 2, event: 0, date: 1, section: "Platea Baja", row: "2", seat: "9", tier: "premium", faceValueCents: 14_000, priceCents: 70_000 },
  { seller: 2, event: 3, date: 0, section: "D 500", row: "P", seat: "112", tier: "budget", faceValueCents: 12_000, priceCents: 44_000 },
  // Sketchy — even worse pricing, off-market barcode patterns.
  { seller: 3, event: 1, date: 0, section: "Tribuna B", row: "3", seat: "1", tier: "premium", faceValueCents: 24_000, priceCents: 96_000 },
  { seller: 3, event: 4, date: 0, section: "Innenraum", row: "1", seat: "5", tier: "premium", faceValueCents: 15_000, priceCents: 52_500 },
];

function daysFromNow(days: number, clock: string): Date {
  const [h = 0, m = 0] = clock.split(":").map(Number);
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function hashBarcode(barcode: string): string {
  return createHash("sha256").update(barcode).digest("hex");
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const pg = postgres(process.env.DATABASE_URL ?? "postgres://fairpass:fairpass@localhost:5433/fairpass");
  if (reset) {
    await pg`truncate table
      seller_trust_scores, smart_alerts, messages, conversations, verification_results,
      orders, ticket_listings, event_dates, events, venues, users
      restart identity cascade`;
    console.log("Cleared existing seed data.");
  }

  const buyer = await registerUser(BUYER);
  const sellerRecords: User[] = [];
  for (const s of SELLERS) {
    const existing = await db.select().from(users).where(eq(users.email, s.email)).limit(1);
    if (existing.length > 0) {
      sellerRecords.push(existing[0]!);
      continue;
    }
    sellerRecords.push(await registerUser(s));
  }

  const venueByName = new Map<string, string>();
  for (const v of VENUES) {
    const [venue] = await db.insert(venues).values(v).returning();
    venueByName.set(v.name, venue!.id);
  }

  const eventDateIds: string[][] = EVENTS.map(() => []);
  for (const [ei, evSeed] of EVENTS.entries()) {
    const ev = evSeed!;
    const [event] = await db
      .insert(events)
      .values({
        venueId: venueByName.get(ev.venue),
        title: ev.title,
        category: ev.category,
        artist: ev.artist,
        description: ev.description,
      })
      .returning();
    for (const d of ev.dates) {
      const [date] = await db
        .insert(eventDates)
        .values({
          eventId: event!.id,
          startsAt: daysFromNow(d.daysFromNow, "20:00"),
          doorsAt: daysFromNow(d.daysFromNow, d.doors),
          status: "on_sale",
        })
        .returning();
      eventDateIds[ei]!.push(date!.id);
    }
  }

  const listingsToComplete: { id: string; seedIndex: number }[] = [];
  for (const [seedIndex, l] of LISTINGS.entries()) {
    const seller = sellerRecords[l.seller]!;
    const [listing] = await db
      .insert(ticketListings)
      .values({
        sellerId: seller.id,
        eventDateId: eventDateIds[l.event]![l.date]!,
        section: l.section,
        row: l.row,
        seat: l.seat,
        tier: l.tier,
        faceValueCents: l.faceValueCents,
        priceCents: l.priceCents,
        currency: "USD",
        status: "active",
        barcodeSha256: hashBarcode(ean13()),
        verificationStatus: l.seller === 0 ? "verified" : "pending",
      })
      .returning();
    if (l.seller === 0) listingsToComplete.push({ id: listing!.id, seedIndex });
  }

  // Give the trusted seller a sales history so trust visibly differs from scalpers.
  // The trusted seller's standard-tier listings become completed/sold history;
  // its budget + premium listings stay ACTIVE so the honest inventory is searchable.
  const completed = listingsToComplete
    .filter((entry) => LISTINGS[entry.seedIndex]?.tier === "standard")
    .map((entry) => entry.id);
  for (const [i, listingId] of completed.entries()) {
    await db.insert(orders).values({
      buyerId: buyer.id,
      listingId,
      status: "completed",
      totalCents: 9_900 + i,
      currency: "USD",
      createdAt: new Date(Date.now() - (i + 1) * 24 * 86_400_000),
    });
  }
  await db
    .update(ticketListings)
    .set({ status: "sold" })
    .where(inArray(ticketListings.id, completed));

  for (const s of sellerRecords) {
    await recomputeTrust(s.id);
  }

  const [userRow] = await db.select({ count: count() }).from(users);
  const [listingRow] = await db.select({ count: count() }).from(ticketListings);
  const [orderRow] = await db.select({ count: count() }).from(orders);
  const [trustRow] = await db.select({ count: count() }).from(sellerTrustScores);
  await pg.end();
  console.log("Seed complete:", {
    users: userRow?.count ?? 0,
    venues: VENUES.length,
    events: EVENTS.length,
    event_dates: eventDateIds.reduce((a, b) => a + b.length, 0),
    listings: listingRow?.count ?? 0,
    orders: orderRow?.count ?? 0,
    trust_scores: trustRow?.count ?? 0,
  });
  // The drizzle pool keeps the event loop alive; exit explicitly in a one-shot script.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});