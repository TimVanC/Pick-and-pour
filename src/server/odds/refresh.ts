import { randomUUID } from "node:crypto";
import { vigFreeProbability } from "@/lib/discount";
import { db } from "../db";
import {
  fixtureTimeAt,
  kalshiReplayProvider,
  realTimeOf,
  type ReplayGameState,
} from "./kalshi-replay";
import type { GameRow, GameUpdate, OddsProvider } from "./provider";
import { homeProbabilityAt, loadFixtureIndex, loadSunday } from "./replay-core";
import {
  DEMO_TEAMS,
  initialSimState,
  linesFor,
  simGameRealSeconds,
  simulatedProvider,
} from "./simulated";

/** Register a real odds API here to replace the simulation. */
const providers: Record<string, OddsProvider> = {
  [simulatedProvider.name]: simulatedProvider,
  [kalshiReplayProvider.name]: kalshiReplayProvider,
};

/** Only featured games are refreshed, and at most this often (seconds). */
const REFRESH_SECONDS = 8;

/**
 * Bring a venue's featured games up to date. Every screen calls this before it
 * reads, so the feed advances whenever anyone is watching and no background
 * job is needed. The UPDATE claims each due game, so two requests arriving
 * together never advance the same game twice.
 */
export async function refreshVenueGames(venueId: string): Promise<void> {
  const sql = db();
  const due = (await sql`
    update games g
    set last_tick_at = now()
    from featured_games f
    where f.game_id = g.id
      and f.venue_id = ${venueId}
      and g.status in ('scheduled', 'live')
      and g.start_time <= now()
      and g.last_tick_at < now() - make_interval(secs => ${REFRESH_SECONDS})
    returning g.*
  `) as GameRow[];

  const now = new Date();
  await Promise.all(
    due.map(async (game) => {
      const provider = providers[game.provider];
      if (!provider) return;
      try {
        await applyUpdate(game, await provider.update(game, now));
      } catch (error) {
        console.error(`[odds] Refreshing game ${game.id} failed:`, error);
      }
    }),
  );
}

/** Store a provider's update: game state, an odds snapshot, and settlement at the final. */
async function applyUpdate(game: GameRow, update: GameUpdate): Promise<void> {
  const sql = db();
  const queries = [
    sql`
      update games set
        status = ${update.status},
        period = ${update.period},
        clock_seconds = ${update.clockSeconds},
        is_break = ${update.isBreak},
        break_label = ${update.breakLabel},
        home_score = ${update.homeScore},
        away_score = ${update.awayScore},
        winner = ${update.winner},
        provider_state = ${JSON.stringify(update.providerState ?? game.provider_state)}::jsonb
      where id = ${game.id}
    `,
  ];

  if (update.odds) {
    const final = update.status === "final";
    const homeP = final
      ? update.winner === "home" ? 1 : update.winner === "away" ? 0 : 0.5
      : vigFreeProbability(update.odds.homeOdds, update.odds.awayOdds);
    queries.push(sql`
      insert into odds_snapshots
        (game_id, home_odds, away_odds, home_p, away_p, books_raw, suspended)
      values (
        ${game.id}, ${update.odds.homeOdds}, ${update.odds.awayOdds},
        ${homeP}, ${1 - homeP},
        ${JSON.stringify(update.odds.booksRaw)}::jsonb, ${update.odds.suspended}
      )
    `);
  }

  if (update.status === "final" && game.status !== "final") {
    // Open picks settle at the final whistle. Locked picks keep their frozen discount.
    queries.push(sql`
      with settled as (
        update picks set
          status = 'settled',
          result = case
            when ${update.winner}::text = 'tie' then 'tie'
            when side = ${update.winner}::text then 'won'
            else 'lost'
          end,
          d_final = case when side = ${update.winner}::text then d_win else 0 end,
          settled_at = now()
        where game_id = ${game.id} and status = 'open'
        returning id, venue_id, result, d_final
      )
      insert into audit_log (venue_id, staff_id, action, pick_id, before, after)
      select venue_id, null, 'settle_final', id,
        jsonb_build_object('status', 'open'),
        jsonb_build_object('status', 'settled', 'result', result, 'd_final', d_final)
      from settled
    `);
  }

  await sql.transaction(queries);
}

export const canSimulate = true;

/**
 * Create a fresh slate of demo games for a venue and feature all of them:
 * three early games kicking off in a minute, two late games and a night game.
 */
export async function createDemoSlate(
  venueId: string,
  favoriteTeams: string[],
): Promise<void> {
  const sql = db();
  const teams = [...DEMO_TEAMS].sort(() => Math.random() - 0.5);
  // Favorite teams go first so they land in the early window.
  teams.sort(
    (a, b) =>
      Number(favoriteTeams.includes(b.name)) - Number(favoriteTeams.includes(a.name)),
  );

  const gap = Math.ceil(simGameRealSeconds()) + 90;
  const windows = [
    { label: "1:00 PM", games: 3, startsIn: 60 },
    { label: "4:25 PM", games: 2, startsIn: 60 + gap },
    { label: "8:20 PM", games: 1, startsIn: 60 + gap * 2 },
  ];

  const now = new Date();
  const queries = [sql`delete from featured_games where venue_id = ${venueId}`];
  let next = 0;
  for (const window of windows) {
    for (let index = 0; index < window.games; index += 1) {
      const home = teams[next];
      const away = teams[next + 1];
      next += 2;
      const id = randomUUID();
      const start = new Date(now.getTime() + window.startsIn * 1000);
      // Kickoff win chance for the home team, anywhere from long shot to heavy favorite.
      const strength = 0.18 + Math.random() * 0.64;
      const lines = linesFor(strength);
      const homeP = vigFreeProbability(lines.homeOdds, lines.awayOdds);
      queries.push(
        sql`
          insert into games
            (id, provider, provider_game_id, home, away, home_abbr, away_abbr,
             start_time, window_label, provider_state)
          values (
            ${id}, 'sim', ${`${venueId}:${id}`}, ${home.name}, ${away.name},
            ${home.abbr}, ${away.abbr}, ${start.toISOString()}, ${window.label},
            ${JSON.stringify(initialSimState(strength, start))}::jsonb
          )
        `,
        sql`
          insert into odds_snapshots
            (game_id, home_odds, away_odds, home_p, away_p, books_raw)
          values (
            ${id}, ${lines.homeOdds}, ${lines.awayOdds}, ${homeP}, ${1 - homeP},
            ${JSON.stringify({ sim: lines })}::jsonb
          )
        `,
        sql`
          insert into featured_games (venue_id, game_id, window_label)
          values (${venueId}, ${id}, ${window.label})
        `,
      );
    }
  }
  await sql.transaction(queries);
}

/** The recorded Sundays that can be replayed, newest first. Empty when no fixtures are present. */
export function replaySundays(): { date: string; games: number; source: string }[] {
  try {
    const index = loadFixtureIndex();
    return index.sundays.map((sunday) => ({
      date: sunday.date,
      games: sunday.games.length,
      source: index.source,
    }));
  } catch {
    return [];
  }
}

/** Most games featured per window when a replay starts, so the TV board stays readable. */
const REPLAY_FEATURED_PER_WINDOW = 4;
/** Real seconds between starting a replay and the first kickoff. */
const REPLAY_LEAD_SECONDS = 45;

/**
 * Start replaying a recorded NFL Sunday for a venue. Every game of that day
 * goes on the schedule; the first four of each kickoff window are featured.
 */
export async function createReplaySlate(
  venueId: string,
  date: string,
  speed: number,
  favoriteTeams: string[],
): Promise<void> {
  const sql = db();
  const fixtures = loadSunday(date).sort((a, b) => a.kickoff - b.kickoff);
  if (fixtures.length === 0) throw new Error(`No games recorded for ${date}.`);

  const realStart = Date.now();
  const firstKickoff = fixtures[0].kickoff;
  const base = {
    fixtureStart: firstKickoff - REPLAY_LEAD_SECONDS * speed,
    realStart,
    speed,
  };

  const queries = [sql`delete from featured_games where venue_id = ${venueId}`];
  const featuredInWindow = new Map<string, number>();
  // Favorite teams are featured first within their window.
  const isFavorite = (name: string) => favoriteTeams.includes(name);
  const ordered = [...fixtures].sort(
    (a, b) =>
      a.kickoff - b.kickoff ||
      Number(isFavorite(b.home.name) || isFavorite(b.away.name)) -
        Number(isFavorite(a.home.name) || isFavorite(a.away.name)),
  );

  for (const fixture of ordered) {
    const id = randomUUID();
    const state: ReplayGameState = { ...base, fixtureId: fixture.id };
    const start = realTimeOf(state, fixture.kickoff);
    const homeP = homeProbabilityAt(fixture, fixtureTimeAt(state, realStart));
    const lines = linesFor(homeP);
    queries.push(
      sql`
        insert into games
          (id, provider, provider_game_id, home, away, home_abbr, away_abbr,
           start_time, window_label, provider_state)
        values (
          ${id}, 'kalshi-replay', ${`${venueId}:${fixture.id}:${realStart}`},
          ${fixture.home.name}, ${fixture.away.name}, ${fixture.home.abbr}, ${fixture.away.abbr},
          ${start.toISOString()}, ${fixture.window}, ${JSON.stringify(state)}::jsonb
        )
      `,
      sql`
        insert into odds_snapshots
          (game_id, home_odds, away_odds, home_p, away_p, books_raw)
        values (
          ${id}, ${lines.homeOdds}, ${lines.awayOdds},
          ${vigFreeProbability(lines.homeOdds, lines.awayOdds)},
          ${vigFreeProbability(lines.awayOdds, lines.homeOdds)},
          ${JSON.stringify({ kalshi: fixture.marketTicker ?? fixture.id, homeP })}::jsonb
        )
      `,
    );
    const count = featuredInWindow.get(fixture.window) ?? 0;
    if (count < REPLAY_FEATURED_PER_WINDOW) {
      featuredInWindow.set(fixture.window, count + 1);
      queries.push(sql`
        insert into featured_games (venue_id, game_id, window_label)
        values (${venueId}, ${id}, ${fixture.window})
      `);
    }
  }
  await sql.transaction(queries);
}
