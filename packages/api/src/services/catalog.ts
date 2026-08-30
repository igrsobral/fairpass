import { and, asc, eq, gte } from "drizzle-orm";
import { events, venues, eventDates } from "../db/schema/index.js";
import type { Event, EventDate } from "../db/schema/index.js";
import { db } from "../db/client.js";

export interface EventWithVenue {
  event: Event;
  city: string | null;
  nextDate: Date | null;
}

export async function listUpcomingEvents(limit = 50): Promise<EventWithVenue[]> {
  const rows = await db
    .select({
      event: events,
      city: venues.city,
      nextDate: eventDates.startsAt,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(
      eventDates,
      and(
        eq(eventDates.eventId, events.id),
        eq(eventDates.status, "on_sale"),
        gte(eventDates.startsAt, new Date()),
      ),
    )
    .orderBy(asc(eventDates.startsAt))
    .limit(limit);

  const byEvent = new Map<string, EventWithVenue>();
  for (const row of rows) {
    const existing = byEvent.get(row.event.id);
    if (!existing) {
      byEvent.set(row.event.id, {
        event: row.event,
        city: row.city,
        nextDate: row.nextDate,
      });
    }
  }
  return [...byEvent.values()];
}

export async function getEventDates(
  eventId: string,
): Promise<(EventDate & { city: string | null })[]> {
  const rows = await db
    .select({
      date: eventDates,
      city: venues.city,
    })
    .from(eventDates)
    .innerJoin(events, eq(eventDates.eventId, events.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(
      and(
        eq(eventDates.eventId, eventId),
        eq(eventDates.status, "on_sale"),
        gte(eventDates.startsAt, new Date()),
      ),
    )
    .orderBy(asc(eventDates.startsAt));

  return rows.map((r) => ({ ...r.date, city: r.city }));
}

export async function getEventById(
  eventId: string,
): Promise<(Event & { city: string | null }) | null> {
  const [row] = await db
    .select({
      event: events,
      city: venues.city,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(eq(events.id, eventId))
    .limit(1);
  return row ? { ...row.event, city: row.city } : null;
}