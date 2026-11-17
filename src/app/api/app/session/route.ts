import { JURISDICTIONS } from "@/lib/discount";
import { body, clientIp, requireVenue, respond } from "@/server/api";
import { db } from "@/server/db";
import { UserError } from "@/server/picks";
import {
  clearSession,
  getSession,
  hashSecret,
  randomToken,
  secretsMatch,
  setSession,
  tooManyAttempts,
  verifySecret,
} from "@/server/session";
import { allVenues, staffForVenue } from "@/server/state";

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Sign-in steps for the bartender app:
 *   setup   create a venue (needs the one-time setup code)
 *   signin  sign this device in to a venue with its passcode
 *   pin     unlock with a staff PIN
 *   lock    back to the PIN pad (switch staff)
 *   signout sign the device out of the venue
 */
export async function POST(request: Request) {
  return respond(async () => {
    const input = await body(request);
    const action = String(input.action ?? "");
    const ip = await clientIp();

    if (action === "setup") {
      if (tooManyAttempts(`setup:${ip}`, 8, TEN_MINUTES)) {
        throw new UserError("Too many tries. Wait a few minutes.");
      }
      const expected = process.env.APP_SETUP_CODE;
      if (!expected) throw new UserError("Setup is not switched on for this site.");
      if (!secretsMatch(String(input.setupCode ?? ""), expected)) {
        throw new UserError("That setup code is not right.");
      }
      const venueName = String(input.venueName ?? "").trim().slice(0, 80);
      const managerName = String(input.managerName ?? "").trim().slice(0, 40);
      const passcode = String(input.passcode ?? "");
      const pin = String(input.pin ?? "");
      if (!venueName) throw new UserError("Add your bar's name.");
      if (!managerName) throw new UserError("Add your name.");
      if (passcode.length < 6) throw new UserError("Use a venue passcode of at least 6 characters.");
      if (!/^\d{4}$/.test(pin)) throw new UserError("A PIN is 4 digits.");
      // The passcode alone picks the venue at sign-in, so it must be unique.
      const venues = await allVenues();
      if (venues.some((venue) => verifySecret(passcode, venue.passcodeHash))) {
        throw new UserError("Choose a different passcode.");
      }

      const nj = JURISDICTIONS.NJ;
      const settings = {
        scale: nj.scaleDefault,
        cap: nj.cap,
        maxCoveredCents: 10000,
        lateCutoffPeriod: 3,
        lockWindowUntil: null,
        favoriteTeams: [],
      };
      const sql = db();
      const [venue] = await sql`
        insert into venues (name, jurisdiction_code, tv_token, passcode_hash, settings)
        values (
          ${venueName}, 'NJ', ${randomToken(18)}, ${hashSecret(passcode)},
          ${JSON.stringify(settings)}::jsonb
        )
        returning id
      `;
      const [manager] = await sql`
        insert into staff (venue_id, name, role, pin_hash)
        values (${venue.id}, ${managerName}, 'manager', ${hashSecret(pin)})
        returning id
      `;
      await setSession({
        venueId: String(venue.id),
        staffId: String(manager.id),
        role: "manager",
      });
      return { ok: true };
    }

    if (action === "signin") {
      if (tooManyAttempts(`signin:${ip}`, 10, TEN_MINUTES)) {
        throw new UserError("Too many tries. Wait a few minutes.");
      }
      const passcode = String(input.passcode ?? "");
      const venues = await allVenues();
      const venue = venues.find((candidate) => verifySecret(passcode, candidate.passcodeHash));
      if (!venue) throw new UserError("That passcode is not right.");
      await setSession({ venueId: venue.id, staffId: null, role: null });
      return { ok: true };
    }

    if (action === "pin") {
      const venue = await requireVenue();
      if (tooManyAttempts(`pin:${venue.id}:${ip}`, 12, TEN_MINUTES)) {
        throw new UserError("Too many tries. Wait a few minutes.");
      }
      const pin = String(input.pin ?? "");
      const staff = (await staffForVenue(venue.id)).find((member) =>
        verifySecret(pin, member.pinHash),
      );
      if (!staff) throw new UserError("That PIN is not right.");
      await setSession({ venueId: venue.id, staffId: staff.id, role: staff.role });
      return { ok: true };
    }

    if (action === "lock") {
      const session = await getSession();
      if (session) await setSession({ venueId: session.venueId, staffId: null, role: null });
      return { ok: true };
    }

    if (action === "signout") {
      await clearSession();
      return { ok: true };
    }

    throw new UserError("Unknown action.");
  });
}
