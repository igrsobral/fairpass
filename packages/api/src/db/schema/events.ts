import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  timezone: text("timezone").notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  artist: text("artist"),
});

export const eventDates = pgTable("event_dates", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  doorsAt: timestamp("doors_at", { withTimezone: true }),
  status: text("status").notNull().default("on_sale"),
});

export type Venue = typeof venues.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventDate = typeof eventDates.$inferSelect;