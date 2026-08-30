import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, closeTestDb } from "./helpers.js";
import { makeEvent, makeEventDate, makeListing, makeUser, makeVenue } from "./factories.js";
import {
  completeOrder,
  expireStaleHolds,
  listBuyerOrders,
  placeHold,
  releaseHold,
  OrderError,
} from "../src/services/orders.js";
import { getSellerTrust } from "./factories.js";
import { ticketListings, orders } from "../src/db/schema/index.js";
import { db } from "../src/db/client.js";
import { eq } from "drizzle-orm";

describe("orders service", () => {
  beforeAll(() => resetDatabase());
  afterAll(async () => closeTestDb());

  beforeEach(() => resetDatabase());

  async function setup() {
    const seller = await makeUser();
    const buyer = await makeUser();
    const venue = await makeVenue();
    const event = await makeEvent(venue.id);
    const date = await makeEventDate(event.id);
    const listing = await makeListing({
      sellerId: seller.id,
      eventDateId: date.id,
      faceValueCents: 10_000,
      priceCents: 12_500,
    });
    return { seller, buyer, date, listing };
  }

  it("places a hold, flips the listing to hold, and records the order", async () => {
    const { buyer, listing } = await setup();

    const order = await placeHold(listing.id, buyer.id);
    expect(order.status).toBe("hold_placed");
    expect(order.totalCents).toBe(12_500);

    const [held] = await db
      .select()
      .from(ticketListings)
      .where(eq(ticketListings.id, listing.id))
      .limit(1);
    expect(held?.status).toBe("hold");
    expect(held?.holdUntil).toBeInstanceOf(Date);

    expect((await listBuyerOrders(buyer.id)).map((o) => o.id)).toContain(order.id);
  });

  it("prevents a second buyer from taking a held listing", async () => {
    const { buyer, listing } = await setup();
    const buyer2 = await makeUser();

    await placeHold(listing.id, buyer.id);
    await expect(placeHold(listing.id, buyer2.id)).rejects.toThrow(/no longer available/);
  });

  it("prevents buying your own listing", async () => {
    const { seller, listing } = await setup();
    await expect(placeHold(listing.id, seller.id)).rejects.toThrow(/own listing/);
  });

  it("completes an order, marks the listing sold, and raises seller trust", async () => {
    const { seller, buyer, listing } = await setup();

    expect(await getSellerTrust(seller.id)).toBeNull();

    const order = await placeHold(listing.id, buyer.id);
    const completed = await completeOrder(order.id, buyer.id);

    expect(completed.status).toBe("completed");
    const [sold] = await db
      .select()
      .from(ticketListings)
      .where(eq(ticketListings.id, listing.id))
      .limit(1);
    expect(sold?.status).toBe("sold");

    const trust = await getSellerTrust(seller.id);
    expect(trust).not.toBeNull();
    expect(trust).toBeGreaterThan(0.4);

    await expect(completeOrder(order.id, buyer.id)).rejects.toThrow(/already completed/);
  });

  it("releases a hold and returns the listing to active", async () => {
    const { buyer, listing } = await setup();

    const order = await placeHold(listing.id, buyer.id);
    const declined = await releaseHold(order.id, buyer.id);
    expect(declined.status).toBe("declined");

    const [relisted] = await db
      .select()
      .from(ticketListings)
      .where(eq(ticketListings.id, listing.id))
      .limit(1);
    expect(relisted?.status).toBe("active");
    expect(relisted?.holdUntil).toBeNull();

    const retry = await placeHold(listing.id, (await makeUser()).id);
    expect(retry.status).toBe("hold_placed");
  });

  it("expires stale holds and frees the listing", async () => {
    const { buyer, listing } = await setup();

    const order = await placeHold(listing.id, buyer.id);
    await db
      .update(orders)
      .set({ createdAt: new Date(Date.now() - 60 * 60_000) })
      .where(eq(orders.id, order.id));

    expect(await expireStaleHolds()).toBe(1);

    const [freed] = await db
      .select()
      .from(ticketListings)
      .where(eq(ticketListings.id, listing.id))
      .limit(1);
    expect(freed?.status).toBe("active");
    expect(freed?.holdUntil).toBeNull();

    await expect(completeOrder(order.id, buyer.id)).rejects.toThrow(/expired/);
  });

  it("does not allow completing another user's order", async () => {
    const { buyer, listing } = await setup();
    const stranger = await makeUser();
    const order = await placeHold(listing.id, buyer.id);
    await expect(completeOrder(order.id, stranger.id)).rejects.toThrow(OrderError);
  });
});