import type { AppState } from "@/lib/app-types";
import { respond } from "@/server/api";
import { db } from "@/server/db";
import { canSimulate, refreshVenueGames } from "@/server/odds/refresh";
import { getSession } from "@/server/session";
import {
  gamesForVenue,
  picksForVenue,
  staffForVenue,
  venueById,
  venueView,
} from "@/server/state";

/** Everything the bartender app shows, polled every few seconds. */
export async function GET() {
  return respond(async (): Promise<AppState> => {
    const session = await getSession();
    const venue = session ? await venueById(session.venueId) : null;
    if (!session || !venue) return { auth: "none" };

    const staffList = await staffForVenue(venue.id);
    const staff = staffList.find((member) => member.id === session.staffId);
    if (!staff) {
      return {
        auth: "device",
        venueName: venue.name,
        staffNames: staffList.map((member) => member.name),
      };
    }

    await refreshVenueGames(venue.id);
    const games = await gamesForVenue(venue);
    const picks = await picksForVenue(venue, games);
    // Read the clock from the database so every screen agrees on "now".
    const [{ now }] = await db()`select now() as now`;

    return {
      auth: "staff",
      venue: venueView(venue),
      staff: { id: staff.id, name: staff.name, role: staff.role },
      games,
      picks,
      manager:
        staff.role === "manager"
          ? {
              staff: staffList.map(({ id, name, role }) => ({ id, name, role })),
              tvToken: venue.tvToken,
              canSimulate,
            }
          : null,
      serverTime: new Date(now as Date).toISOString(),
    };
  });
}
