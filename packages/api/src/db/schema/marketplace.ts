import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { eventDates } from "./events.js";
import { users } from "./auth.js";

export const ticketListings = pgTable("ticket_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => users.id),
  eventDateId: uuid("event_date_id")
    .notNull()
    .references(() => eventDates.id),
  section: text("section"),
  row: text("row"),
  seat: text("seat"),
  tier: text("tier").notNull(), // e.g. premium | standard | budget
  faceValueCents: integer("face_value_cents").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("active"), // active | hold | sold | cancelled
  barcodeSha256: text("barcode_sha256"),
  verificationStatus: text("verification_status").notNull().default("pending"), // pending | verified | failed
  holdUntil: timestamp("hold_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => ticketListings.id),
  status: text("status").notNull().default("hold_placed"), // hold_placed | hold_expired | completed | declined
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TicketListing = typeof ticketListings.$inferSelect;
export type NewTicketListing = typeof ticketListings.$inferInsert;
export type Order = typeof orders.$inferSelect;