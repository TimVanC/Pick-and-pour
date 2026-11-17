import type { GuestState } from "@/lib/app-types";
import { respond } from "@/server/api";
import { db } from "@/server/db";
import { refreshVenueGames } from "@/server/odds/refresh";
import { gamesForVenue, pickFromRow, venueById, venueView } from "@/server/state";

const DAY_MS = 24 * 60 * 60 * 1000;

/** One guest's pick, reached from the QR code. No sign-in; the token is the secret. */
export async function GET(_request: Request, context: RouteContext<"/api/p/[token]">) {
  return respond(async (): Promise<GuestState | Response> => {
    const { token } = await context.params;
    const gone = Response.json({ error: "This pick link has expired." }, { status: 404 });

    const rows = await db()`select * from picks where guest_token = ${token}`;
    const row = rows[0];
    if (!row) return gone;

    // The link stops working 24 hours after the pick is settled.
    const ended = row.applied_at ?? row.settled_at ?? (row.status === "void" ? row.created_at : null);
    if (ended && Date.now() - new Date(String(ended)).getTime() > DAY_MS) return gone;

    const venue = await venueById(String(row.venue_id));
    if (!venue) return gone;
    await refreshVenueGames(venue.id);
    const [game] = await gamesForVenue(venue, { gameId: String(row.game_id) });
    if (!game) return gone;

    const view = venueView(venue);
    const pick = pickFromRow(row, game, new Date());
    return {
      venueName: view.name,
      rulesText: view.rulesText,
      maxCoveredCents: view.settings.maxCoveredCents,
      pick: {
        gameId: pick.gameId,
        side: pick.side,
        tabLabel: pick.tabLabel,
        seat: pick.seat,
        pEntry: pick.pEntry,
        entryLine: pick.entryLine,
        dWin: pick.dWin,
        status: pick.status,
        result: pick.result,
        dFinal: pick.dFinal,
        lockValue: pick.lockValue,
        subtotalAtPickCents: pick.subtotalAtPickCents,
        subtotalAtSettleCents: pick.subtotalAtSettleCents,
        coveredCents: pick.coveredCents,
        discountCents: pick.discountCents,
        createdAt: pick.createdAt,
        lockedAt: pick.lockedAt,
        settledAt: pick.settledAt,
        appliedAt: pick.appliedAt,
      },
      game,
      serverTime: new Date().toISOString(),
    };
  });
}
