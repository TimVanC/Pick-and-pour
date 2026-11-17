import type { TvState } from "@/lib/app-types";
import { respond } from "@/server/api";
import { refreshVenueGames } from "@/server/odds/refresh";
import { gamesForVenue, venueByTvToken, venueView } from "@/server/state";

/** The TV board's data: the featured games of the current window. No sign-in, secret link. */
export async function GET(_request: Request, context: RouteContext<"/api/tv/[token]">) {
  return respond(async (): Promise<TvState | Response> => {
    const { token } = await context.params;
    const venue = await venueByTvToken(token);
    if (!venue) return Response.json({ error: "Unknown board." }, { status: 404 });

    await refreshVenueGames(venue.id);
    const featured = await gamesForVenue(venue, { featuredOnly: true });

    // The current window is the earliest one that still has a game to play.
    const windows = [...new Set(featured.map((game) => game.windowLabel))];
    const current =
      windows.find((label) =>
        featured.some((game) => game.windowLabel === label && game.status !== "final"),
      ) ?? windows.at(-1);

    const view = venueView(venue);
    return {
      venueName: view.name,
      rulesText: view.rulesText,
      limits: view.limits,
      games: featured.filter((game) => game.windowLabel === current),
      serverTime: new Date().toISOString(),
    };
  });
}
