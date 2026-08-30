import { describe, expect, it } from "vitest";
import { searchQuerySchema } from "../src/types.js";

describe("searchQuerySchema", () => {
  it("parses a canonical natural-language extraction", () => {
    const parsed = searchQuerySchema.parse({
      intent: "buy",
      eventName: "Oasis: Live '25",
      city: "Buenos Aires",
      quantity: 2,
      maxTotalCents: 18000,
      tier: "standard",
    });

    expect(parsed.quantity).toBe(2);
    expect(parsed.maxTotalCents).toBe(18000);
    expect(parsed.city).toBe("Buenos Aires");
  });

  it("defaults quantity to 1 when absent", () => {
    const parsed = searchQuerySchema.parse({ intent: "buy" });
    expect(parsed.quantity).toBe(1);
  });

  it("rejects invalid quantities", () => {
    expect(() =>
      searchQuerySchema.parse({ intent: "buy", quantity: 0 }),
    ).toThrow();
  });

  it("rejects a budget below 1 cent", () => {
    expect(() =>
      searchQuerySchema.parse({ intent: "buy", maxTotalCents: 0 }),
    ).toThrow();
  });
});