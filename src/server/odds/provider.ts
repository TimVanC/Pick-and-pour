import type { GameStatus, Side } from "@/lib/app-types";

/** A row of the `games` table, as the providers see it. */
export type GameRow = {
  id: string;
  provider: string;
  provider_game_id: string;
  home: string;
  away: string;
  home_abbr: string;
  away_abbr: string;
  start_time: Date;
  window_label: string;
  status: GameStatus;
  period: number;
  clock_seconds: number;
  is_break: boolean;
  break_label: string | null;
  home_score: number;
  away_score: number;
  winner: Side | "tie" | null;
  provider_state: unknown;
};

/** The latest state of one game, as reported by a provider. */
export type GameUpdate = {
  status: GameStatus;
  period: number;
  clockSeconds: number;
  isBreak: boolean;
  breakLabel: string | null;
  homeScore: number;
  awayScore: number;
  winner: Side | "tie" | null;
  /** Consensus American moneylines. Null when the provider has none right now. */
  odds: {
    homeOdds: number;
    awayOdds: number;
    suspended: boolean;
    /** The individual books behind the consensus, stored for audits. */
    booksRaw: unknown;
  } | null;
  /** Anything the provider wants to remember between updates. */
  providerState?: unknown;
};

/**
 * Where live moneylines and game state come from. The app only talks to this
 * interface, so the built-in simulation can be swapped for a commercial odds
 * API by adding one more implementation and registering it in refresh.ts.
 */
export interface OddsProvider {
  /** Stored in games.provider. */
  readonly name: string;
  /** How often a live game is refreshed, in seconds. */
  readonly liveIntervalSeconds: number;
  /** Fetch the latest state for one game. */
  update(game: GameRow, now: Date): Promise<GameUpdate>;
}
