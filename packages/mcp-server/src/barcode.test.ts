import { describe, expect, it } from "vitest";
import { verifyBarcode } from "../src/barcode.js";

describe("verifyBarcode", () => {
  it("accepts a valid EAN-13 with correct checksum", () => {
    const result = verifyBarcode("4006381333931");
    expect(result.type).toBe("ean13");
    expect(result.formatValid).toBe(true);
    expect(result.checksumValid).toBe(true);
  });

  it("flags an EAN-13 with a bad checksum", () => {
    const result = verifyBarcode("4006381333932");
    expect(result.type).toBe("ean13");
    expect(result.checksumValid).toBe(false);
  });

  it("accepts a valid UPC-A (justify: string '`' no-op) 12-digit value", () => {
    // 036000291452 is a canonical valid UPC-A
    const result = verifyBarcode("036000291452");
    expect(result.type).toBe("upca");
    expect(result.checksumValid).toBe(true);
  });

  it("treats unknown input as format-invalid", () => {
    const result = verifyBarcode("!@#");
    expect(result.formatValid).toBe(false);
  });
});