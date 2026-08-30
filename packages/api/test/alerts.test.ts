import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, closeTestDb } from "./helpers.js";
import { makeUser } from "./factories.js";
import { createAlert, listAlerts, setAlertActive, AlertError } from "../src/services/alerts.js";
import type { SearchQuery } from "../src/types.js";

const FILTERS: SearchQuery = {
  intent: "alert",
  eventName: "Oasis",
  city: "Buenos Aires",
  maxUnitCents: 15_000,
  quantity: 2,
};

describe("smart alerts service", () => {
  beforeAll(() => resetDatabase());
  afterAll(async () => closeTestDb());

  beforeEach(() => resetDatabase());

  it("creates an active alert with the structured query persisted", async () => {
    const user = await makeUser();
    const alert = await createAlert({
      userId: user.id,
      query: "two tickets to Oasis in Buenos Aires under $150",
      filters: FILTERS,
    });

    expect(alert.active).toBe(true);
    expect(alert.query).toContain("Oasis");
    expect(alert.filters).toMatchObject({ eventName: "Oasis", city: "Buenos Aires", quantity: 2 });
  });

  it("rejects an empty query and invalid filters", async () => {
    const user = await makeUser();
    await expect(
      createAlert({ userId: user.id, query: "   ", filters: FILTERS }),
    ).rejects.toThrow(AlertError);
    await expect(
      createAlert({
        userId: user.id,
        query: "tickets",
        filters: { ...FILTERS, tier: "banana" as unknown as "premium" },
      }),
    ).rejects.toThrow();
  });

  it("lists only the current user's alerts", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await createAlert({ userId: user.id, query: "Oasis", filters: FILTERS });
    await createAlert({ userId: other.id, query: "Coldplay", filters: FILTERS });

    const mine = await listAlerts(user.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.query).toBe("Oasis");
  });

  it("toggles an alert on and off, scoped to the owner", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const alert = await createAlert({
      userId: user.id,
      query: "Oasis Buenos Aires",
      filters: FILTERS,
      thresholdCents: 12_000,
    });

    const off = await setAlertActive(alert.id, user.id, false);
    expect(off.active).toBe(false);

    const on = await setAlertActive(alert.id, user.id, true);
    expect(on.active).toBe(true);
    expect(on.thresholdCents).toBe(12_000);

    await expect(setAlertActive(alert.id, other.id, false)).rejects.toThrow(/not found/);
  });
});