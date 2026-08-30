/**
 * Barcode format + checksum validation.
 *
 * Focused on the numeric symbologies a P2P ticket must carry:
 *   - EAN-13 and UPC-A encode a global identifier AND a self-checking
 *     checksum digit -> a cheap, deterministic fraud-detection signal.
 *   - QR / PDF417 are opaque payloads; we validate structural shape only;
 *     deep metadata extraction is handled by the LLM helper (Phase 4) from
 *     a normalized, PII-redacted payload.
 */

export type BarcodeType = "ean13" | "upca" | "qr" | "pdf417" | "unknown";

export interface BarcodeVerification {
  type: BarcodeType;
  formatValid: boolean;
  checksumValid: boolean | null;
  digits: string | null;
}

function normalize(input: string): string {
  return input.replace(/\s/g, "").trim();
}

function isEanChecksumValid(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  const payload = digits.slice(0, 12);
  const check = digits[12];
  const calculated = payload
    .split("")
    .reduce((sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - (calculated % 10)) % 10;
  return expected === Number(check);
}

function isUpcChecksumValid(digits: string): boolean {
  if (!/^\d{12}$/.test(digits)) return false;
  // UPC-A digits 0..11, check digit is position 11 (rightmost).
  const payload = digits.slice(0, 11);
  const check = digits[11];
  const calculated = payload
    .split("")
    .reduce(
      (sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 3 : 1),
      0,
    );
  const expected = (10 - (calculated % 10)) % 10;
  return expected === Number(check);
}

function detectType(input: string): BarcodeType {
  const clean = normalize(input);
  if (/^\d{12}$/.test(clean)) return "upca";
  if (/^\d{13}$/.test(clean)) return "ean13";
  if (/^[A-Za-z0-9\-_.!~*'();/?:@&=+$,%#]{20,200}$/.test(clean)) {
    // structural heuristic: printable payload in a plausible range
    return clean.length > 40 ? "pdf417" : "qr";
  }
  return "unknown";
}

export function verifyBarcode(input: string): BarcodeVerification {
  const clean = normalize(input);
  const type = detectType(clean);

  if (type === "unknown") {
    return { type, formatValid: false, checksumValid: null, digits: null };
  }

  if (type === "ean13" || type === "upca") {
    const digits = clean.replace(/[^0-9]/g, "");
    const checksumValid =
      type === "ean13"
        ? isEanChecksumValid(digits)
        : isUpcChecksumValid(digits);
    return {
      type,
      formatValid: true,
      checksumValid,
      digits,
    };
  }

  // QR / PDF417: format-valid by construction; no checksum defined.
  return { type, formatValid: true, checksumValid: null, digits: null };
}