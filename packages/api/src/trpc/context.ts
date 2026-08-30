import { readCookie, serializeCookie } from "../http/cookie.js";
import { SESSION_COOKIE, verifySessionToken } from "../auth/session.js";
import { getUserById } from "../services/auth.js";
import type { User } from "../db/schema/auth.js";
import type { CookieOptions } from "../http/cookie.js";

export interface TRPCContext {
  user: User | null;
  setCookie: (name: string, value: string, options?: CookieOptions) => void;
  clearCookie: (name: string) => void;
}

export interface CreateContextInput {
  headers: Headers;
  /** Host appends each emitted Set-Cookie header to the response. */
  cookiesOut?: (cookieHeader: string) => void;
}

export async function createContext(
  input: CreateContextInput,
): Promise<TRPCContext> {
  const emit = input.cookiesOut ?? (() => {});

  const token = readCookie(input.headers, SESSION_COOKIE);
  let user: User | null = null;
  if (token) {
    const userId = await verifySessionToken(token);
    if (userId) user = await getUserById(userId);
  }

  const baseOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  };

  return {
    user,
    setCookie: (name, value, options) =>
      emit(serializeCookie(name, value, { ...baseOptions, ...options })),
    clearCookie: (name) =>
      emit(serializeCookie(name, "", { ...baseOptions, maxAge: 0 })),
  };
}