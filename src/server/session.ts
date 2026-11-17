import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@/lib/app-types";

/**
 * Sign-in for the bartender app. Two steps, one signed cookie:
 * 1. A device is signed in to a venue with the venue passcode (lasts 30 days).
 * 2. A staff member unlocks it with their 4-digit PIN (switch any time).
 */
export type Session = {
  venueId: string;
  staffId: string | null;
  role: Role | null;
};

const COOKIE = "pp_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set.");
  }
  return "dev-only-session-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return {
      venueId: String(data.venueId),
      staffId: data.staffId ?? null,
      role: data.role ?? null,
    };
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + THIRTY_DAYS * 1000 }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Salted hash for passcodes and PINs, stored as "salt:hash". */
export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 32).toString("hex")}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return safeEqual(scryptSync(value, salt, 32).toString("hex"), hash);
}

/** Compare two secrets without leaking where they differ. */
export function secretsMatch(a: string, b: string): boolean {
  return safeEqual(sign(a), sign(b));
}

export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Small in-memory attempt limiter for passcode and PIN guesses. It is per
 * server instance, which is enough to slow guessing on a pilot.
 */
const attempts = new Map<string, number[]>();

export function tooManyAttempts(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > max;
}
