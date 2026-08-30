import { and, eq } from "drizzle-orm";
import { smartAlerts } from "../db/schema/index.js";
import type { SmartAlert } from "../db/schema/index.js";
import { db } from "../db/client.js";
import { searchQuerySchema } from "../types.js";
import type { SearchQuery } from "../types.js";

export class AlertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertError";
  }
}

export interface CreateAlertInput {
  userId: string;
  query: string;
  filters: SearchQuery;
  thresholdCents?: number | null;
}

export async function createAlert(
  input: CreateAlertInput,
): Promise<SmartAlert> {
  if (input.query.trim().length === 0) {
    throw new AlertError("Query must not be empty");
  }
  const filters = searchQuerySchema.parse(input.filters);

  const [alert] = await db
    .insert(smartAlerts)
    .values({
      userId: input.userId,
      query: input.query.trim(),
      filters,
      thresholdCents: input.thresholdCents ?? null,
      active: true,
    })
    .returning();
  if (!alert) throw new AlertError("Failed to create alert");
  return alert;
}

export async function listAlerts(userId: string): Promise<SmartAlert[]> {
  return db
    .select()
    .from(smartAlerts)
    .where(eq(smartAlerts.userId, userId))
    .orderBy(smartAlerts.createdAt);
}

export async function setAlertActive(
  alertId: string,
  userId: string,
  active: boolean,
): Promise<SmartAlert> {
  const [alert] = await db
    .select()
    .from(smartAlerts)
    .where(and(eq(smartAlerts.id, alertId), eq(smartAlerts.userId, userId)))
    .limit(1);
  if (!alert) throw new AlertError("Alert not found");

  const [updated] = await db
    .update(smartAlerts)
    .set({ active })
    .where(eq(smartAlerts.id, alertId))
    .returning();
  return updated as SmartAlert;
}