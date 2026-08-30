import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats whole dollars from cents", () => {
    expect(formatCurrency(18000)).toBe("$180.00");
  });

  it("formats cents below a dollar", () => {
    expect(formatCurrency(95)).toBe("$0.95");
  });

  it("handles negative values", () => {
    expect(formatCurrency(-500)).toBe("-$5.00");
  });
});