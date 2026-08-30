import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, closeTestDb } from "./helpers.js";
import {
  makeEvent,
  makeEventDate,
  makeListing,
  makeUser,
  makeVenue,
  futureDate,
} from "./factories.js";
import {
  cancelListing,
  createListing,
  listActiveForEventDate,
  listMyListings,
  ListingError,
} from "../src/services/listings.js";
import { eventDates } from "../src/db/schema/index.js";
import { db } from "../src/db/client.js";
import { eq } from "drizzle-orm";

describe("listings service", () => {
  beforeAll(() => resetDatabase());
  afterAll(async () => closeTestDb());

  beforeEach(() => resetDatabase());

  it("creates an active listing with barcode hashed at rest", async () => {
    const seller = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id);
    const date = await makeEventDate(event.id);

    const listing = await makeListing({
      sellerId: seller.id,
      eventDateId: date.id,
      faceValueCents: 10_000,
      priceCents: 12_000,
      barcode: "4006381333931",
      tier: "premium",
      section: "A",
      row: "3",
      seat: "14",
    });

    expect(listing.status).toBe("active");
    expect(listing.barcodeSha256).not.toBe("4006381333931");
    expect(listing.barcodeSha256).toHaveLength(64);
    expect(listing.verificationStatus).toBe("pending");
  });

  it("rejects a listing for a past or non-on-sale event date", async () => {
    const seller = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id);
    const past = await makeEventDate(event.id, futureDate(-2));

    await expect(
      createListing({
        sellerId: seller.id,
        eventDateId: past.id,
        faceValueCents: 10_000,
        priceCents: 11_000,
        tier: "standard",
      }),
    ).rejects.toThrow(ListingError);

    const soldOut = await makeEventDate(event.id, futureDate(5));
    await db.update(eventDates).set({ status: "sold_out" }).where(eq(eventDates.id, soldOut.id));

    await expect(
      createListing({
        sellerId: seller.id,
        eventDateId: soldOut.id,
        faceValueCents: 10_000,
        priceCents: 11_000,
        tier: "standard",
      }),
    ).rejects.toThrow(/no longer on sale/);
  });

  it("lists active listings for an event date with deviation and trust", async () => {
    const seller = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id, "Headliner Night");
    const date = await makeEventDate(event.id);

    const atFace = await makeListing({
      sellerId: seller.id,
      eventDateId: date.id,
      faceValueCents: 10_000,
      priceCents: 10_000,
    });
    const scalped = await makeListing({
      sellerId: seller.id,
      eventDateId: date.id,
      faceValueCents: 10_000,
      priceCents: 35_000,
    });

    const results = await listActiveForEventDate(date.id);
    expect(results).toHaveLength(2);

    const byPrice = new Map(results.map((r) => [r.listing.id, r]));
    expect(byPrice.get(atFace.id)?.deviationPct).toBe(0);
    expect(byPrice.get(scalped.id)?.deviationPct).toBe(250);
    const sorted = [...results].sort((a, b) => a.listing.priceCents - b.listing.priceCents);
    expect(sorted[0]!.listing.priceCents).toBeLessThan(sorted[1]!.listing.priceCents);
    expect(results.every((r) => r.eventTitle === "Headliner Night")).toBe(true);
    expect(results.every((r) => r.city === "Test City")).toBe(true);
  });

  it("only the owner can cancel, and only while active", async () => {
    const seller = await makeUser();
    const other = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id);
    const date = await makeEventDate(event.id);
    const listing = await makeListing({ sellerId: seller.id, eventDateId: date.id });

    await expect(cancelListing(listing.id, other.id)).rejects.toThrow(/own listings/);

    const cancelled = await cancelListing(listing.id, seller.id);
    expect(cancelled.status).toBe("cancelled");
    expect((await listActiveForEventDate(date.id)).some((r) => r.listing.id === listing.id)).toBe(false);

    await expect(cancelListing(listing.id, seller.id)).rejects.toThrow(/active listings/);
  });

  it("lists only the current user's listings", async () => {
    const sellerA = await makeUser();
    const sellerB = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id);
    const date = await makeEventDate(event.id);

    const a1 = await makeListing({ sellerId: sellerA.id, eventDateId: date.id });
    const a2 = await makeListing({ sellerId: sellerA.id, eventDateId: date.id });
    await makeListing({ sellerId: sellerB.id, eventDateId: date.id });

    const mine = await listMyListings(sellerA.id);
    expect(mine.map((l) => l.id).sort()).toEqual([a1.id, a2.id].sort());
  });
});