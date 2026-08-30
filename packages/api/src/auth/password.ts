import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

function scryptAsync(
  password: string,
  salt: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export interface StoredPassword {
  salt: string;
  hash: string;
}

const SCHEME = "scrypt";

export async function hashPassword(password: string): Promise<StoredPassword> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return { salt, hash: derived.toString("hex") };
}

export function encodeStoredPassword(stored: StoredPassword): string {
  return `${SCHEME}:${stored.salt}:${stored.hash}`;
}

export function decodeStoredPassword(encoded: string): StoredPassword | null {
  const [scheme, salt, hash] = encoded.split(":");
  if (scheme !== SCHEME || !salt || !hash) return null;
  return { salt, hash };
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const decoded = decodeStoredPassword(stored);
  if (!decoded) return false;

  const derived = await scryptAsync(password, decoded.salt);
  const expected = Buffer.from(decoded.hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}