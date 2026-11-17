import type { GameRow, GameUpdate, OddsProvider } from "./provider";
import {
  breakBetween,
  homeProbabilityAt,
  loadFixtureGame,
  stateAt,
} from "./replay-core";
import { linesFor } from "./simulated";

/**
 * Plays a recorded NFL Sunday back as if it were live: real Kalshi prices and
 * real scores and break times, at an adjustable speed. Nothing is fetched at
 * run time; the data comes from the JSON fixtures in /fixtures/kalshi.
 */

export type ReplayGameState = {
  fixtureId: string;
  /** Fixture time (epoch seconds) that corresponds to `realStart`. */
  fixtureStart: number;
  /** Real time (epoch milliseconds) the replay began. */
  realStart: number;
  /** Fixture seconds per real second. 60 plays an hour of football in a minute. */
  speed: number;
  /** Fixture time of the previous update, so a short break is never skipped over. */
  lastT?: number;
};

/** Where the replay is in fixture time, given the real time. */
export function fixtureTimeAt(state: ReplayGameState, nowMs: number): number {
  return state.fixtureStart + ((nowMs - state.realStart) / 1000) * state.speed;
}

/** The real time at which the replay reaches a fixture time. */
export function realTimeOf(state: ReplayGameState, fixtureT: number): Date {
  return new Date(state.realStart + ((fixtureT - state.fixtureStart) / state.speed) * 1000);
}

export const kalshiReplayProvider: OddsProvider = {
  name: "kalshi-replay",
  liveIntervalSeconds: 8,

  async update(game: GameRow, now: Date): Promise<GameUpdate> {
    const state = game.provider_state as ReplayGameState;
    const fixture = loadFixtureGame(state.fixtureId);
    const t = fixtureTimeAt(state, now.getTime());
    const live = stateAt(fixture, t);
    const nextState: ReplayGameState = { ...state, lastT: t };

    if (live.status === "final") {
      const homeWon = live.winner === "home";
      return {
        status: "final",
        period: live.period,
        clockSeconds: 0,
        isBreak: false,
        breakLabel: null,
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        winner: live.winner,
        odds: {
          homeOdds: homeWon ? -100000 : 100000,
          awayOdds: homeWon ? 100000 : -100000,
          suspended: false,
          booksRaw: { kalshi: fixture.marketTicker ?? fixture.id, final: true },
        },
        providerState: nextState,
      };
    }

    // At replay speed a two-minute quarter break can fall between two updates.
    // If one did, report it for this update so the lock-in window still opens.
    const skipped =
      !live.isBreak && state.lastT !== undefined ? breakBetween(fixture, state.lastT, t) : null;
    const homeP = homeProbabilityAt(fixture, t);
    const lines = linesFor(homeP);
    return {
      status: live.status,
      period: live.period,
      clockSeconds: live.clockSeconds,
      isBreak: live.isBreak || skipped !== null,
      breakLabel: live.breakLabel ?? skipped?.label ?? null,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      winner: null,
      odds: {
        ...lines,
        suspended: false,
        // The Kalshi price itself, beside the moneylines derived from it.
        booksRaw: { kalshi: fixture.marketTicker ?? fixture.id, homeP, source: fixture.source },
      },
      providerState: nextState,
    };
  },
};
