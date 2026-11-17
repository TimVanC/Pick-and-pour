/**
 * Shapes shared by the app's API routes and its screens (bartender, TV, guest).
 * Probabilities and discounts are decimals (0 to 1); money is integer cents;
 * times are ISO strings.
 */

import type { CheckDiscount, LineDiscount } from "./line-discount";
import type { PosCheck } from "@/server/pos/provider";

export type Side = "home" | "away";
export type Role = "manager" | "bartender";
export type GameStatus = "scheduled" | "live" | "final" | "postponed" | "cancelled";
export type PickStatus = "open" | "locked" | "settled" | "applied" | "void";

export type VenueSettings = {
  scale: number;
  cap: number;
  maxCoveredCents: number;
  /** Last period in which a new pick is allowed (3 = until the end of Q3). */
  lateCutoffPeriod: number;
  /** A manager-opened lock-in window stays open until this time. */
  lockWindowUntil: string | null;
  favoriteTeams: string[];
  /** Where tabs come from: typed in by hand, or open checks from a POS. */
  posProvider: "manual" | "mock-toast";
};

export type TeamView = {
  name: string;
  abbr: string;
  score: number;
  /** Live American line, e.g. "+150". Null before the first odds arrive. */
  line: string | null;
  /** Live vig-free win probability. */
  p: number | null;
  /** Win probability at kickoff (the first snapshot). */
  kickoffP: number | null;
};

export type GameView = {
  id: string;
  windowLabel: string;
  startTime: string;
  status: GameStatus;
  /** 1 to 4 for quarters, 5 for overtime, 0 before kickoff. */
  period: number;
  clockSeconds: number;
  isBreak: boolean;
  breakLabel: string | null;
  winner: Side | "tie" | null;
  home: TeamView;
  away: TeamView;
  /** The odds market is paused (a big play under review). */
  suspended: boolean;
  /** No fresh odds for over 2 minutes during a live game. */
  stale: boolean;
  featured: boolean;
  /** New picks are allowed right now. */
  entryOpen: boolean;
  /** Lock-ins are allowed right now. */
  lockOpen: boolean;
};

export type PickView = {
  id: string;
  gameId: string;
  side: Side;
  tabLabel: string;
  seat: string;
  staffName: string | null;
  pEntry: number;
  entryLine: string | null;
  /** Discount if the side wins, fixed at entry. */
  dWin: number;
  status: PickStatus;
  /** won, lost, tie, locked, closed, undone or void. Null while open. */
  result: string | null;
  /** The frozen discount once locked or settled. */
  dFinal: number | null;
  /** What the pick could lock in for right now (open picks only). */
  lockValue: number | null;
  subtotalAtPickCents: number;
  subtotalAtSettleCents: number | null;
  coveredCents: number | null;
  discountCents: number | null;
  guestToken: string;
  createdAt: string;
  lockedAt: string | null;
  settledAt: string | null;
  appliedAt: string | null;
  /** The creating or locking staff member can undo until this time. */
  undoUntil: string | null;
  /** The POS check this pick is attached to. Null for a tab entered by hand. */
  posOrderId: string | null;
  posCheckId: string | null;
  /** The line-by-line discount that was posted to the POS check. */
  discountLines: LineDiscount[] | null;
};

/** An open POS check, with the pick already on it if there is one. */
export type PosCheckView = PosCheck & { activePickId: string | null };

/** What settling a POS-attached pick would post to the check right now. */
export type SettlementPreview = { check: PosCheck; discount: CheckDiscount };

export type StaffView = { id: string; name: string; role: Role };

export type VenueView = {
  name: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  rulesText: string;
  settings: VenueSettings;
  /** The scale and cap in force after the jurisdiction's limits. */
  limits: { scale: number; cap: number };
  /** True when item costs are loaded from a POS, so discounts are limited item by item. */
  costFloors: boolean;
  /** The highest cap this venue may choose right now. */
  maxCap: number;
};

/** What GET /api/app/state returns, depending on how far sign-in has got. */
export type AppState =
  | { auth: "none" }
  | { auth: "device"; venueName: string; staffNames: string[] }
  | {
      auth: "staff";
      venue: VenueView;
      staff: StaffView;
      games: GameView[];
      picks: PickView[];
      /** Managers only. */
      manager: {
        staff: StaffView[];
        tvToken: string;
        canSimulate: boolean;
        /** Recorded NFL Sundays that can be replayed (empty when no fixtures are present). */
        replaySundays: { date: string; games: number; source: string }[];
      } | null;
      serverTime: string;
    };

export type TvState = {
  venueName: string;
  rulesText: string;
  limits: { scale: number; cap: number };
  games: GameView[];
  serverTime: string;
};

export type GuestState = {
  venueName: string;
  rulesText: string;
  maxCoveredCents: number;
  pick: Omit<
    PickView,
    "id" | "staffName" | "guestToken" | "undoUntil" | "posOrderId" | "posCheckId" | "discountLines"
  >;
  game: GameView;
  serverTime: string;
};

export type ReportView = {
  date: string;
  picks: number;
  players: number;
  coveredCents: number;
  discountCents: number;
  /** Discount dollars ÷ covered spend. Null when nothing was covered. */
  averageDiscount: number | null;
  won: number;
  lost: number;
  locked: number;
  open: number;
  voided: number;
  /** Average minutes from pick to applied. Null when none were applied. */
  minutesToSettle: number | null;
};

/** "Q2 4:12", "Halftime", "Final", or the kickoff time. */
export function gameClockLabel(game: GameView): string {
  if (game.status === "final") return game.period >= 5 ? "Final (OT)" : "Final";
  if (game.status === "postponed") return "Postponed";
  if (game.status === "cancelled") return "Cancelled";
  if (game.status === "scheduled") {
    return `Kickoff ${new Date(game.startTime).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  if (game.isBreak && game.breakLabel) return game.breakLabel;
  const period = game.period >= 5 ? "OT" : `Q${game.period}`;
  const minutes = Math.floor(game.clockSeconds / 60);
  const seconds = String(game.clockSeconds % 60).padStart(2, "0");
  return `${period} ${minutes}:${seconds}`;
}

/** When guests can next lock in, for the TV header. */
export function nextLockInLabel(games: GameView[]): string {
  const live = games.filter((game) => game.status === "live");
  if (live.some((game) => game.lockOpen)) return "Lock-in window open";
  if (live.length === 0) {
    return games.some((game) => game.status === "scheduled")
      ? "Next lock-in: end of Q1"
      : "Game day complete";
  }
  const period = Math.min(...live.map((game) => game.period));
  if (period <= 1) return "Next lock-in: end of Q1";
  if (period === 2) return "Next lock-in: halftime";
  if (period === 3) return "Next lock-in: end of Q3";
  return "Final stretch: no more lock-ins";
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
