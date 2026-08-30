import { eq } from "drizzle-orm";
import { hashPassword, encodeStoredPassword, verifyPassword } from "../auth/password.js";
import { db } from "../db/client.js";
import { users } from "../db/schema/auth.js";
import type { User } from "../db/schema/auth.js";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError("Invalid email address");
  }
  if (input.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters");
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new AuthError("An account with this email already exists");
  }

  const stored = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name.trim(),
      passwordHash: encodeStoredPassword(stored),
    })
    .returning();
  if (!created) throw new AuthError("Failed to create account");
  return created;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (!user?.passwordHash) throw new AuthError("Invalid credentials");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AuthError("Invalid credentials");
  return user;
}

export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}