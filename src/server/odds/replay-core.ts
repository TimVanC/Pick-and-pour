import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Side } from "@/lib/app-types";

/**
 * Recorded NFL Sundays: Kalshi's public win-probability prices minute by
 * minute, lined up with the real quarter breaks from nflverse play-by-play.
 * The files live in /fixtures/kalshi and are written by scripts/fetch-fixtures.mjs.
 * All fixture times are epoch SECONDS.
 */

export type FixtureGame = {
  id: string;
  /** "kalshi" for real prices, "synthetic" for generated ones. */
  source: string;
  eventTicker?: string;
  marketTicker?: string;
  date: string;
  kickoff: number;
  end: number;
  /** Kickoff in US Eastern, e.g. "1:00 PM". */
  window: string;
  home: { abbr: string; name: string };
  away: { abbr: string; name: string };
  winner: Side | "tie";
  finalScore: { home: number; away: number } | null;
  /** "nflverse" for real break times, "estimated" otherwise. */
  breaksSource: string;
  periods: { period: number; start: number; end: number }[];
  breaks: { label: string; start: number; end: number }[];
  states: { t: number; period: number; clockSeconds: number; homeScore: number; awayScore: number }[];
  /** One per minute. `homeP` is the home team's win probability, 0 to 1. */
  candles: { t: number; homeP: number }[];
};

export type FixtureIndex = {
  generatedAt: string;
  source: string;
  notes: string;
  sundays: { date: string; games: string[] }[];
};

export type ReplayState = {
  status: "scheduled" | "live" | "final";
  period: number;
  clockSeconds: number;
  isBreak: boolean;
  breakLabel: string | null;
  homeScore: number;
  awayScore: number;
  winner: Side | "tie" | null;
};

const FIXTURE_DIR = join(process.cwd(), "fixtures", "kalshi");
const cache = new Map<string, FixtureGame>();

export function loadFixtureIndex(dir = FIXTURE_DIR): FixtureIndex {
  return JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as FixtureIndex;
}

export function loadFixtureGame(id: string, dir = FIXTURE_DIR): FixtureGame {
  const key = `${dir}:${id}`;
  let game = cache.get(key);
  if (!game) {
    // Ids come from the index, but never let one reach outside the fixture folder.
    if (!/^[\w-]+$/.test(id)) throw new Error(`Bad fixture id: ${id}`);
    game = JSON.parse(readFileSync(join(dir, "games", `${id}.json`), "utf8")) as FixtureGame;
    cache.set(key, game);
  }
  return game;
}

export function loadSunday(date: string, dir = FIXTURE_DIR): FixtureGame[] {
  const sunday = loadFixtureIndex(dir).sundays.find((entry) => entry.date === date);
  if (!sunday) throw new Error(`No recorded Sunday for ${date}.`);
  return sunday.games.map((id) => loadFixtureGame(id, dir));
}

/** The last entry at or before time `t` (entries sorted by `t`). Null when `t` is before the first. */
function latestAt<T extends { t: number }>(entries: T[], t: number): T | null {
  let low = 0;
  let high = entries.length - 1;
  let found: T | null = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (entries[middle].t <= t) {
      found = entries[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** The home team's win probability at fixture time `t`, held between 1% and 99% until the game ends. */
export function homeProbabilityAt(game: FixtureGame, t: number): number {
  if (t >= game.end) return game.winner === "home" ? 1 : game.winner === "away" ? 0 : 0.5;
  const candle = latestAt(game.candles, t) ?? game.candles[0];
  const p = candle ? candle.homeP : 0.5;
  return Math.min(0.99, Math.max(0.01, p));
}

/** A side's win probability at fixture time `t`. */
export function sideProbabilityAt(game: FixtureGame, side: Side, t: number): number {
  const home = homeProbabilityAt(game, t);
  return side === "home" ? home : 1 - home;
}

const PERIOD_AFTER_BREAK: Record<string, number> = {
  "End of Q1": 1,
  Halftime: 2,
  "End of Q3": 3,
};

/** Score, period, clock and break state at fixture time `t`. */
export function stateAt(game: FixtureGame, t: number): ReplayState {
  if (t < game.kickoff) {
    return {
      status: "scheduled",
      period: 0,
      clockSeconds: 0,
      isBreak: false,
      breakLabel: null,
      homeScore: 0,
      awayScore: 0,
      winner: null,
    };
  }
  const last = game.states.at(-1);
  if (t >= game.end) {
    return {
      status: "final",
      period: game.periods.at(-1)?.period ?? 4,
      clockSeconds: 0,
      isBreak: false,
      breakLabel: null,
      homeScore: game.finalScore?.home ?? last?.homeScore ?? 0,
      awayScore: game.finalScore?.away ?? last?.awayScore ?? 0,
      winner: game.winner,
    };
  }

  const score = latestAt(game.states, t);
  const pause = game.breaks.find((entry) => t >= entry.start && t < entry.end);
  if (pause) {
    return {
      status: "live",
      period: PERIOD_AFTER_BREAK[pause.label] ?? score?.period ?? 1,
      clockSeconds: 0,
      isBreak: true,
      breakLabel: pause.label,
      homeScore: score?.homeScore ?? 0,
      awayScore: score?.awayScore ?? 0,
      winner: null,
    };
  }
  const current =
    game.periods.find((entry) => t >= entry.start && t < entry.end) ??
    [...game.periods].reverse().find((entry) => t >= entry.start);
  return {
    status: "live",
    period: current?.period ?? score?.period ?? 1,
    clockSeconds: score?.clockSeconds ?? 0,
    isBreak: false,
    breakLabel: null,
    homeScore: score?.homeScore ?? 0,
    awayScore: score?.awayScore ?? 0,
    winner: null,
  };
}

/** The break that was in progress at any moment in the fixture-time range (from, to]. */
export function breakBetween(
  game: FixtureGame,
  from: number,
  to: number,
): { label: string; start: number; end: number } | null {
  return game.breaks.find((entry) => entry.start <= to && entry.end > from) ?? null;
}
