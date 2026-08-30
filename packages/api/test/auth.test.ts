import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, closeTestDb } from "./helpers.js";
import { makeUser } from "./factories.js";
import { registerUser, loginUser, getUserById, AuthError } from "../src/services/auth.js";
import { hashPassword, verifyPassword, encodeStoredPassword, decodeStoredPassword } from "../src/auth/password.js";
import { createSessionToken, verifySessionToken } from "../src/auth/session.js";

describe("auth services", () => {
  beforeAll(() => resetDatabase());
  afterAll(async () => closeTestDb());

  beforeEach(() => resetDatabase());

  it("hashes passwords with scrypt and round-trips verification", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.salt).toMatch(/^[a-f0-9]{32}$/);
    expect(stored.hash).toMatch(/^[a-f0-9]{128}$/);

    const encoded = encodeStoredPassword(stored);
    expect(encoded.startsWith("scrypt:")).toBe(true);

    const decoded = decodeStoredPassword(encoded);
    expect(await verifyPassword("correct horse battery", encoded)).toBe(true);
    expect(await verifyPassword("wrong password", encoded)).toBe(false);
    expect(decoded).toEqual(stored);
  });

  it("registers a new user and hashes the password in storage", async () => {
    const user = await makeUser();
    expect(user.id).toBeTruthy();
    expect(user.passwordHash).toMatch(/^scrypt:/);
    expect(user.passwordHash).not.toContain("password123");
    expect(await getUserById(user.id)).toMatchObject({ email: user.email });

    const fetched = await loginUser(user.email, "password123");
    expect(fetched.id).toBe(user.id);
  });

  it("rejects duplicate emails case-insensitively", async () => {
    const user = await makeUser();
    await expect(
      registerUser({
        email: user.email.toUpperCase(),
        name: "Cloner",
        password: "password123",
      }),
    ).rejects.toThrow(AuthError);
    await expect(
      registerUser({
        email: user.email,
        name: "Cloner",
        password: "password123",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("rejects short passwords and malformed emails", async () => {
    await expect(
      registerUser({ email: "x@y.com", name: "X", password: "short" }),
    ).rejects.toThrow(/at least 8/);
    await expect(
      registerUser({ email: "not-an-email", name: "X", password: "password123" }),
    ).rejects.toThrow(/Invalid email/);
  });

  it("rejects bad credentials on login", async () => {
    const user = await makeUser();
    await expect(loginUser(user.email, "wrong-pass")).rejects.toThrow(/credentials/);
    await expect(loginUser("nobody@example.com", "password123")).rejects.toThrow(/credentials/);
  });

  it("issues and verifies session tokens", async () => {
    const user = await makeUser();
    const token = await createSessionToken(user.id);
    expect(token.split(".")).toHaveLength(3);
    expect(await verifySessionToken(token)).toBe(user.id);
    expect(await verifySessionToken("garbage.token.here")).toBeNull();
  });
});