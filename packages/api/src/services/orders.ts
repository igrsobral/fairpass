import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { orders, ticketListings } from "../db/schema/index.js";
import type { Order } from "../db/schema/index.js";
import { db } from "../db/client.js";
import { recomputeTrust } from "./sellers.js";

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

export const HOLD_MINUTES = 15;

const HOLD_MS = HOLD_MINUTES * 60_000;

export async function expireStaleHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - HOLD_MS);
  const expired = await db
    .select({ id: orders.id, listingId: orders.listingId })
    .from(orders)
    .where(
      and(eq(orders.status, "hold_placed"), lt(orders.createdAt, cutoff)),
    );

  if (expired.length === 0) return 0;

  await db
    .update(orders)
    .set({ status: "hold_expired" })
    .where(inArray(orders.id, expired.map((o) => o.id)));

  await db
    .update(ticketListings)
    .set({ status: "active", holdUntil: null, updatedAt: new Date() })
    .where(
      inArray(
        ticketListings.id,
        expired.map((o) => o.listingId),
      ),
    );

  return expired.length;
}

export async function placeHold(
  listingId: string,
  buyerId: string,
): Promise<Order> {
  await expireStaleHolds();

  const [listing] = await db
    .select()
    .from(ticketListings)
    .where(eq(ticketListings.id, listingId))
    .limit(1);
  if (!listing) throw new OrderError("Listing not found");
  if (listing.status !== "active") {
    throw new OrderError("This listing is no longer available");
  }
  if (listing.sellerId === buyerId) {
    throw new OrderError("You cannot buy your own listing");
  }

  return db.transaction(async (tx) => {
    const holdUntil = new Date(Date.now() + HOLD_MS);
    const claimed = await tx
      .update(ticketListings)
      .set({ status: "hold", holdUntil, updatedAt: new Date() })
      .where(
        and(
          eq(ticketListings.id, listingId),
          eq(ticketListings.status, "active"),
        ),
      )
      .returning();

    if (claimed.length === 0) {
      throw new OrderError("This listing is no longer available");
    }

    const [order] = await tx
      .insert(orders)
      .values({
        buyerId,
        listingId,
        status: "hold_placed",
        totalCents: listing.priceCents,
        currency: listing.currency,
      })
      .returning();
    if (!order) throw new OrderError("Failed to create order");
    return order;
  });
}

export async function completeOrder(
  orderId: string,
  buyerId: string,
): Promise<Order> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new OrderError("Order not found");
  if (order.buyerId !== buyerId) {
    throw new OrderError("You can only complete your own orders");
  }
  if (order.status === "completed") throw new OrderError("Order already completed");

  await expireStaleHolds();
  const [fresh] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!fresh || fresh.status !== "hold_placed") {
    throw new OrderError("This hold has expired");
  }

  const [listingForSeller] = await db
    .select({ sellerId: ticketListings.sellerId })
    .from(ticketListings)
    .where(eq(ticketListings.id, order.listingId))
    .limit(1);

  const completed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: "completed" })
      .where(eq(orders.id, orderId))
      .returning();
    if (!updated) throw new OrderError("Order not found");

    await tx
      .update(ticketListings)
      .set({ status: "sold", holdUntil: null, updatedAt: new Date() })
      .where(eq(ticketListings.id, order.listingId));

    return updated;
  });

  if (listingForSeller) {
    await recomputeTrust(listingForSeller.sellerId);
  }
  return completed as Order;
}

export async function releaseHold(
  orderId: string,
  buyerId: string,
): Promise<Order> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new OrderError("Order not found");
  if (order.buyerId !== buyerId) {
    throw new OrderError("You can only release your own orders");
  }
  if (order.status !== "hold_placed") {
    throw new OrderError("Only held orders can be released");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: "declined" })
      .where(eq(orders.id, orderId))
      .returning();
    await tx
      .update(ticketListings)
      .set({ status: "active", holdUntil: null, updatedAt: new Date() })
      .where(eq(ticketListings.id, order.listingId));
    return updated as Order;
  });
}

export async function listBuyerOrders(buyerId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.buyerId, buyerId))
    .orderBy(desc(orders.createdAt));
}