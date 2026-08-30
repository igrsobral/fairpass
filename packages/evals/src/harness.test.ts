import { describe, expect, it } from "vitest";
import { summarize } from "./harness.js";

describe("summarize", () => {
  it("counts passes and failures", () => {
    const run = summarize("query-understanding", [
      { id: "a", ok: true },
      { id: "b", ok: false, diff: { x: 1 } },
      { id: "c", ok: true },
    ]);

    expect(run.total).toBe(3);
    expect(run.passed).toBe(2);
    expect(run.failed).toBe(1);
  });
});