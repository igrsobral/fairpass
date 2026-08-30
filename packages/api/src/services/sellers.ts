import { and, count, eq } from "drizzle-orm";
import { orders, ticketListings, sellerTrustScores } from "../db/schema/index.js";
import { db } from "../db/client.js";

/**
 * A transparent, deterministic trust score in [0, 1] so search reranking and
 * evals stay reproducible.
 *
 *   base 0.40
 *   + 0.35 * min(1, completedSales / 5)     — volume signal
 *   + 0.25 * verificationRate               — share of listings verified
 *   capped at 1.0.
 *
 * Volume / verification are intentionally coarse so the score is stable and
 * explainable ("4 sales, 100% verified").
 */
export async function recomputeTrust(sellerId: string): Promise<number> {
  const [saleCountRow] = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(ticketListings, eq(orders.listingId, ticketListings.id))
    .where(
      and(
        eq(ticketListings.sellerId, sellerId),
        eq(orders.status, "completed"),
      ),
    );
  const completedSales = saleCountRow?.value ?? 0;

  const listingStats = await db
    .select()
    .from(ticketListings)
    .where(eq(ticketListings.sellerId, sellerId));

  const totalListings = listingStats.length;
  const verified = listingStats.filter(
    (l) => l.verificationStatus === "verified",
  ).length;
  const verificationRate =
    totalListings > 0 ? verified / totalListings : 0;

  const score = Math.min(
    1,
    0.4 + 0.35 * Math.min(1, completedSales / 5) + 0.25 * verificationRate,
  );

  await db
    .insert(sellerTrustScores)
    .values({
      sellerId,
      score,
      numberOfSales: completedSales,
      verificationRate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sellerTrustScores.sellerId,
      set: {
        score,
        numberOfSales: completedSales,
        verificationRate,
        updatedAt: new Date(),
      },
    });

  return Math.round(score * 100) / 100;
}