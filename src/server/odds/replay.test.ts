import { describe, expect, it } from "vitest";
import { fixtureTimeAt, kalshiReplayProvider, realTimeOf, type ReplayGameState } from "./kalshi-replay";
import type { GameRow } from "./provider";
import {
  breakBetween,
  homeProbabilityAt,
  loadFixtureGame,
  loadFixtureIndex,
  loadSunday,
  sideProbabilityAt,
  stateAt,
} from "./replay-core";

const index = loadFixtureIndex();
const firstId = index.sundays[0].games[0];
const game = loadFixtureGame(firstId);

describe("recorded fixtures", () => {
  it("cover three or four Sundays with a full slate each", () => {
    expect(index.sundays.length).toBeGreaterThanOrEqual(3);
    for (const sunday of index.sundays) {
      expect(sunday.games.length).toBeGreaterThanOrEqual(10);
      expect(loadSunday(sunday.date).length).toBe(sunday.games.length);
    }
  });

  it("have one candle per minute, in order, and breaks inside the game", () => {
    for (const sunday of index.sundays) {
      for (const id of sunday.games) {
        const fixture = loadFixtureGame(id);
        for (let i = 1; i < fixture.candles.length; i += 1) {
          expect(fixture.candles[i].t - fixture.candles[i - 1].t).toBe(60);
        }
        expect(fixture.breaks.map((entry) => entry.label)).toEqual(["End of Q1", "Halftime", "End of Q3"]);
        for (const entry of fixture.breaks) {
          expect(entry.start).toBeGreaterThanOrEqual(fixture.kickoff);
          expect(entry.end).toBeLessThanOrEqual(fixture.end);
          expect(entry.end).toBeGreaterThan(entry.start);
        }
        expect(["home", "away", "tie"]).toContain(fixture.winner);
      }
    }
  });

  it("refuses a fixture id that could escape the folder", () => {
    expect(() => loadFixtureGame("../index")).toThrow();
  });
});

describe("state at a moment", () => {
  it("is scheduled before kickoff, live during, final after", () => {
    expect(stateAt(game, game.kickoff - 60).status).toBe("scheduled");
    const live = stateAt(game, game.kickoff + 600);
    expect(live.status).toBe("live");
    expect(live.period).toBe(1);
    const final = stateAt(game, game.end + 1);
    expect(final).toMatchObject({ status: "final", winner: game.winner });
    expect(final.homeScore).toBe(game.finalScore?.home);
  });

  it("reports the break and the period it follows", () => {
    const halftime = game.breaks.find((entry) => entry.label === "Halftime")!;
    const during = stateAt(game, halftime.start + 30);
    expect(during).toMatchObject({ isBreak: true, breakLabel: "Halftime", period: 2, clockSeconds: 0 });
    const after = stateAt(game, halftime.end + 120);
    expect(after.isBreak).toBe(false);
    expect(after.period).toBe(3);
  });

  it("never lets the score go backwards", () => {
    let home = 0;
    let away = 0;
    for (let t = game.kickoff; t <= game.end; t += 60) {
      const state = stateAt(game, t);
      expect(state.homeScore).toBeGreaterThanOrEqual(home);
      expect(state.awayScore).toBeGreaterThanOrEqual(away);
      home = state.homeScore;
      away = state.awayScore;
    }
  });
});

describe("probability at a moment", () => {
  it("stays between 1% and 99% until the final, then settles on the winner", () => {
    for (let t = game.kickoff - 3600; t < game.end; t += 300) {
      const p = homeProbabilityAt(game, t);
      expect(p).toBeGreaterThanOrEqual(0.01);
      expect(p).toBeLessThanOrEqual(0.99);
    }
    expect(homeProbabilityAt(game, game.end)).toBe(game.winner === "home" ? 1 : 0);
    expect(sideProbabilityAt(game, "away", game.kickoff)).toBeCloseTo(1 - homeProbabilityAt(game, game.kickoff));
  });

  it("finds a short break that fell between two updates", () => {
    const q1 = game.breaks[0];
    expect(breakBetween(game, q1.start - 60, q1.end + 60)?.label).toBe("End of Q1");
    expect(breakBetween(game, game.kickoff, game.kickoff + 60)).toBeNull();
  });
});

describe("KalshiReplayOddsProvider", () => {
  const state: ReplayGameState = {
    fixtureId: firstId,
    fixtureStart: game.kickoff - 60 * 30,
    realStart: 1_000_000_000_000,
    speed: 30,
  };
  const row = (providerState: ReplayGameState, status: GameRow["status"] = "live"): GameRow => ({
    id: "g",
    provider: "kalshi-replay",
    provider_game_id: "x",
    home: game.home.name,
    away: game.away.name,
    home_abbr: game.home.abbr,
    away_abbr: game.away.abbr,
    start_time: realTimeOf(providerState, game.kickoff),
    window_label: game.window,
    status,
    period: 0,
    clock_seconds: 0,
    is_break: false,
    break_label: null,
    home_score: 0,
    away_score: 0,
    winner: null,
    provider_state: providerState,
  });

  it("maps real time to fixture time at the chosen speed", () => {
    const later = realTimeOf(state, game.kickoff);
    expect(fixtureTimeAt(state, later.getTime())).toBeCloseTo(game.kickoff, 3);
    // 30x: one real minute is thirty fixture minutes.
    expect(fixtureTimeAt(state, state.realStart + 60_000) - state.fixtureStart).toBe(1800);
  });

  it("serves the recorded price as a moneyline while live", async () => {
    const at = realTimeOf(state, game.kickoff + 600);
    const update = await kalshiReplayProvider.update(row(state), at);
    expect(update.status).toBe("live");
    expect(update.period).toBe(1);
    expect(update.odds).not.toBeNull();
    const homeP = homeProbabilityAt(game, game.kickoff + 600);
    expect((update.odds!.booksRaw as { homeP: number }).homeP).toBeCloseTo(homeP, 3);
    // The favorite gets the negative line.
    expect(update.odds!.homeOdds < 0).toBe(homeP >= 0.5);
  });

  it("settles on the recorded winner after the end", async () => {
    const update = await kalshiReplayProvider.update(row(state), realTimeOf(state, game.end + 60));
    expect(update).toMatchObject({ status: "final", winner: game.winner });
    expect(update.homeScore).toBe(game.finalScore?.home);
  });

  it("does not skip a quarter break at high speed", async () => {
    const q1 = game.breaks[0];
    // Previous update was just before the break; this one lands just after it.
    const before: ReplayGameState = { ...state, speed: 240, lastT: q1.start - 10 };
    const update = await kalshiReplayProvider.update(row(before), realTimeOf(before, q1.end + 10));
    expect(update.isBreak).toBe(true);
    expect(update.breakLabel).toBe("End of Q1");
  });
});
