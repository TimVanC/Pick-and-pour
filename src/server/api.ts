import { headers } from "next/headers";
import type { Role } from "@/lib/app-types";
import { db } from "./db";
import { UserError } from "./picks";
import { PosError } from "./pos/provider";
import { getSession } from "./session";
import { venueById, type Venue } from "./state";

/** Thrown when a request needs a sign-in it does not have. */
export class AuthError extends Error {}

export type SignedInStaff = { id: string; name: string; role: Role };

/** The venue this device is signed in to. */
export async function requireVenue(): Promise<Venue> {
  const session = await getSession();
  const venue = session ? await venueById(session.venueId) : null;
  if (!venue) throw new AuthError("Sign in to your venue first.");
  return venue;
}

/** The venue plus the staff member who unlocked the device with their PIN. */
export async function requireStaff(
  role?: Role,
): Promise<{ venue: Venue; staff: SignedInStaff }> {
  const session = await getSession();
  const venue = session ? await venueById(session.venueId) : null;
  if (!session || !venue) throw new AuthError("Sign in to your venue first.");
  if (!session.staffId) throw new AuthError("Enter your PIN.");
  const rows = await db()`
    select id, name, role from staff
    where id = ${session.staffId} and venue_id = ${venue.id} and active
  `;
  if (!rows[0]) throw new AuthError("Enter your PIN.");
  const staff = {
    id: String(rows[0].id),
    name: String(rows[0].name),
    role: rows[0].role as Role,
  };
  if (role === "manager" && staff.role !== "manager") {
    throw new UserError("Only a manager can do that.");
  }
  return { venue, staff };
}

export async function clientIp(): Promise<string> {
  const list = await headers();
  return (
    list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown"
  );
}

/** Run a route handler and turn its errors into JSON the screens can show. */
export async function respond(run: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof UserError || error instanceof PosError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    // Next.js signals "this route needs a live request" with its own errors
    // (they carry a digest). Those are not failures; let the framework have them.
    if (typeof (error as { digest?: unknown })?.digest === "string") throw error;
    console.error("[api]", error);
    return Response.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}

/** Read a JSON request body as a plain object (empty when missing or malformed). */
export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
