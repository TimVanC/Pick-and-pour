import type { GameRow, GameUpdate, OddsProvider } from "./provider";

/**
 * The built-in demo feed: made-up football games that play themselves at
 * several times real speed, with scores, quarter breaks and a moneyline that
 * follows the score. No real games, no outside service.
 */

/** Game seconds per real second. 6 means a 60-minute game takes 10 minutes. */
function speed(): number {
  return Number(process.env.SIM_SPEED) || 6;
}
const QUARTER_SECONDS = 15 * 60;
const GAME_SECONDS = QUARTER_SECONDS * 4;
/** Bookmaker margin added to the fair line. */
const OVERROUND = 1.045;

type Phase =
  | { kind: "quarter"; period: number }
  | { kind: "break"; label: string; realSeconds: number; afterPeriod: number };

const PHASES: Phase[] = [
  { kind: "quarter", period: 1 },
  { kind: "break", label: "End of Q1", realSeconds: 45, afterPeriod: 1 },
  { kind: "quarter", period: 2 },
  { kind: "break", label: "Halftime", realSeconds: 75, afterPeriod: 2 },
  { kind: "quarter", period: 3 },
  { kind: "break", label: "End of Q3", realSeconds: 45, afterPeriod: 3 },
  { kind: "quarter", period: 4 },
];

export type SimState = {
  /** When the simulation was last advanced (epoch milliseconds). */
  t: number;
  /** Index into PHASES. */
  phase: number;
  /** Seconds left in the phase: game seconds in a quarter, real seconds in a break. */
  left: number;
  /** The home team's chance of winning at kickoff. */
  strength: number;
};

export const DEMO_TEAMS: { name: string; abbr: string }[] = [
  { name: "Hoboken Herons", abbr: "HOB" },
  { name: "Midtown Monarchs", abbr: "MID" },
  { name: "Asbury Foxes", abbr: "ASB" },
  { name: "Cape May Captains", abbr: "CAP" },
  { name: "Trenton Thunder Cats", abbr: "TRE" },
  { name: "Brooklyn Brewers", abbr: "BKN" },
  { name: "Newark Night Owls", abbr: "NWK" },
  { name: "Montclair Mules", abbr: "MTC" },
  { name: "Princeton Pilots", abbr: "PRI" },
  { name: "Jersey Shore Sharks", abbr: "JSS" },
  { name: "Paterson Pumas", abbr: "PAT" },
  { name: "Camden Comets", abbr: "CAM" },
];

/** Real seconds one simulated game lasts, including breaks. */
export function simGameRealSeconds(): number {
  const breaks = PHASES.reduce(
    (sum, phase) => sum + (phase.kind === "break" ? phase.realSeconds : 0),
    0,
  );
  return GAME_SECONDS / speed() + breaks;
}

export function initialSimState(strength: number, now: Date): SimState {
  return { t: now.getTime(), phase: 0, left: QUARTER_SECONDS, strength };
}

function logistic(z: number): number {
  return 1 / (1 + Math.exp(-1.7 * z));
}

/** Home win chance from the score, the time left and the kickoff strength. */
function homeWinProbability(
  diff: number,
  gameSecondsLeft: number,
  strength: number,
): number {
  const fraction = Math.max(gameSecondsLeft / GAME_SECONDS, 0.004);
  // Expected final margin for the home team, scaled by how much game is left.
  const edge = (13.5 * Math.log(strength / (1 - strength))) / 1.7;
  const z = (diff + edge * fraction) / (13.5 * Math.sqrt(fraction));
  return Math.min(0.99, Math.max(0.01, logistic(z)));
}

function toAmerican(probability: number): number {
  const q = Math.min(0.995, Math.max(0.005, probability));
  const raw = q >= 0.5 ? (-100 * q) / (1 - q) : (100 * (1 - q)) / q;
  const rounded = Math.round(raw / 5) * 5;
  if (Math.abs(rounded) < 100) return rounded < 0 ? -100 : 100;
  return rounded;
}

/** Moneylines for both sides, with a bookmaker margin baked in. */
export function linesFor(homeProbability: number): { homeOdds: number; awayOdds: number } {
  return {
    homeOdds: toAmerican(homeProbability * OVERROUND),
    awayOdds: toAmerican((1 - homeProbability) * OVERROUND),
  };
}

function gameSecondsLeft(state: SimState): number {
  let total = 0;
  for (let index = state.phase; index < PHASES.length; index += 1) {
    if (PHASES[index].kind !== "quarter") continue;
    total += index === state.phase ? state.left : QUARTER_SECONDS;
  }
  return total;
}

export const simulatedProvider: OddsProvider = {
  name: "sim",
  liveIntervalSeconds: 8,

  async update(game: GameRow, now: Date): Promise<GameUpdate> {
    const state = { ...(game.provider_state as SimState) };
    let homeScore = game.home_score;
    let awayScore = game.away_score;

    // Real seconds to play forward. A game that has not kicked off starts at its start time.
    const from = game.status === "scheduled" ? game.start_time.getTime() : state.t;
    let realSeconds = Math.max(0, (now.getTime() - from) / 1000);
    state.t = now.getTime();

    let finished = false;
    while (realSeconds > 0 && !finished) {
      const phase = PHASES[state.phase];
      if (phase.kind === "quarter") {
        const played = Math.min(realSeconds * speed(), state.left);
        // Roll for a score every 30 game seconds: about eight scores a game.
        for (let elapsed = 0; elapsed < played; elapsed += 30) {
          const chunk = Math.min(30, played - elapsed);
          if (Math.random() < (chunk * 8) / GAME_SECONDS) {
            const points = Math.random() < 0.62 ? 7 : 3;
            const homeShare = 0.5 + (state.strength - 0.5) * 0.5;
            if (Math.random() < homeShare) homeScore += points;
            else awayScore += points;
          }
        }
        state.left -= played;
        realSeconds -= played / speed();
      } else {
        const waited = Math.min(realSeconds, state.left);
        state.left -= waited;
        realSeconds -= waited;
      }

      if (state.left <= 0.001) {
        if (state.phase === PHASES.length - 1) {
          finished = true;
        } else {
          state.phase += 1;
          const next = PHASES[state.phase];
          state.left = next.kind === "quarter" ? QUARTER_SECONDS : next.realSeconds;
        }
      }
    }

    let period = 0;
    const phase = PHASES[state.phase];
    period = phase.kind === "quarter" ? phase.period : phase.afterPeriod;

    if (finished) {
      // No ties in the demo: a field goal in overtime decides it.
      if (homeScore === awayScore) {
        period = 5;
        if (Math.random() < state.strength) homeScore += 3;
        else awayScore += 3;
      }
      const homeWon = homeScore > awayScore;
      return {
        status: "final",
        period,
        clockSeconds: 0,
        isBreak: false,
        breakLabel: null,
        homeScore,
        awayScore,
        winner: homeWon ? "home" : "away",
        odds: {
          homeOdds: homeWon ? -100000 : 100000,
          awayOdds: homeWon ? 100000 : -100000,
          suspended: false,
          booksRaw: { sim: "final" },
        },
        providerState: state,
      };
    }

    const isBreak = phase.kind === "break";
    const probability = homeWinProbability(
      homeScore - awayScore,
      gameSecondsLeft(state),
      state.strength,
    );
    const lines = linesFor(probability);
    return {
      status: "live",
      period,
      clockSeconds: isBreak ? 0 : Math.round(state.left),
      isBreak,
      breakLabel: isBreak ? phase.label : null,
      homeScore,
      awayScore,
      winner: null,
      odds: {
        ...lines,
        // Now and then a big play is "under review" and the market pauses.
        suspended: !isBreak && Math.random() < 0.03,
        booksRaw: { sim: lines },
      },
      providerState: state,
    };
  },
};
