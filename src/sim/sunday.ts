import type { Side } from "@/lib/app-types";
import {
  effectiveLimits,
  lockInDiscount,
  winDiscount,
  type JurisdictionProfile,
} from "@/lib/discount";
import { discountCheck, type CheckLine } from "@/lib/line-discount";
import { MOCK_RESTAURANT } from "@/server/pos/menu";
import { MemoryPosStore, MockToastProvider } from "@/server/pos/mock-toast";
import type { PosCheck, PosMenuItem } from "@/server/pos/provider";
import {
  sideProbabilityAt,
  stateAt,
  type FixtureGame,
} from "@/server/odds/replay-core";

/**
 * A whole game day at the mock bar, replayed against a recorded NFL Sunday.
 * Guests arrive and order through the mock POS, some of them play, a few lock
 * in at halftime, and every pick settles line by line under the venue's
 * jurisdiction rules. Deterministic for a given seed. No network, no database.
 */

export type SundayParams = {
  profile: JurisdictionProfile;
  /** House multiplier. Ignored where the profile locks it (New York). */
  scale?: number;
  cap?: number;
  /** True when item costs are loaded (a POS is connected). */
  costFloors: boolean;
  maxCoveredCents: number;
  /** Last period in which a new pick is allowed. */
  lateCutoffPeriod: number;
  /** How many tabs the bar opens over the day. */
  guests: number;
  /** Share of guests who play. */
  playRate: number;
  /** Share of players who take the underdog (the rest take the favorite). */
  underdogShare: number;
  /** Chance that a player whose side is ahead at halftime locks in. */
  lockInRate: number;
  /** Games featured per kickoff window. */
  featuredPerWindow: number;
  seed: number;
};

export const DEFAULT_SUNDAY: Omit<SundayParams, "profile" | "costFloors"> = {
  maxCoveredCents: 10_000,
  lateCutoffPeriod: 3,
  guests: 140,
  playRate: 0.3,
  underdogShare: 0.5,
  lockInRate: 0.35,
  featuredPerWindow: 4,
  seed: 1,
};

export type SideHedge = {
  gameId: string;
  matchup: string;
  side: Side;
  team: string;
  /** Picks on this side that were still riding at the final (not locked in). */
  openPicks: number;
  /** What the bar pays out in discounts if this side wins. */
  exposureCents: number;
  /** Kalshi price of this side at kickoff, in dollars per $1 contract. */
  kickoffPrice: number;
  /** $1 contracts that cover the exposure. */
  contracts: number;
  /** What those contracts cost at the kickoff price (before Kalshi's fees). */
  costCents: number;
  /** What they pay if this side wins. */
  payoutCents: number;
  won: boolean;
};

export type SundayResult = {
  date: string;
  profile: string;
  scale: number;
  cap: number;
  costFloors: boolean;
  games: number;
  featuredGames: number;
  guests: number;
  players: number;
  /** Everything rung in at the bar, before discounts. */
  barSalesCents: number;
  /** Spend the picks covered (winners and losers alike). */
  coveredCents: number;
  discountCents: number;
  /** What the discounts would have been without the per-item limits. */
  unlimitedDiscountCents: number;
  /** Discounts ÷ covered spend. */
  effectiveDiscount: number;
  /** Discounts ÷ all bar sales. */
  discountShareOfSales: number;
  picks: { won: number; lost: number; lockedIn: number; underdogs: number; favorites: number };
  /** Lines where a per-item limit cut the discount. */
  limitedLines: number;
  /** The same picks and tabs, if every game had gone the costlier way for the bar. */
  worstCase: { discountCents: number; effectiveDiscount: number };
  /** ...and if every game had gone the cheaper way. */
  bestCase: { discountCents: number };
  hedges: SideHedge[];
  hedgeTotals: {
    /** Buying the hedge on every side with exposure. */
    costCents: number;
    /** What those hedges paid given the real results. */
    payoutCents: number;
    /** Discounts on picks that rode to the final (the part a hedge covers). */
    ridingDiscountCents: number;
  };
  /** Every check as the POS ended up holding it, for inspection and tests. */
  checks: PosCheck[];
};

/** Small seeded random generator, so a simulation can be repeated exactly. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pick = {
  game: FixtureGame;
  side: Side;
  underdog: boolean;
  pEntry: number;
  dWin: number;
  pickedAt: number;
  lockedAt: number | null;
  /** Null while the pick is still riding. */
  dFinal: number | null;
};

type Guest = {
  name: string;
  arriveAt: number;
  plays: boolean;
  check: PosCheck | null;
  nextOrderAt: number;
  pickAt: number;
  /** Infinity for a player whose game is still going. */
  leaveAt: number;
  pick: Pick | null;
  /** The check's lines when it was closed, kept for the what-if totals. */
  finalLines: CheckLine[];
  gone: boolean;
};

const MINUTE = 60;
const DRINK_GROUPS: [string, number][] = [
  ["Draft Beer", 0.38],
  ["Cocktails", 0.3],
  ["Wine by the Glass", 0.17],
  ["Bottles & Cans", 0.15],
];

function toLines(check: PosCheck): CheckLine[] {
  return check.lines.map((line) => ({
    id: line.id,
    name: line.name,
    priceCents: line.priceCents,
    costCents: line.costCents,
    addedAt: new Date(line.addedAt).getTime(),
    voided: line.voided,
  }));
}

export async function simulateSunday(
  fixtures: FixtureGame[],
  params: SundayParams,
): Promise<SundayResult> {
  if (fixtures.length === 0) throw new Error("No games to simulate.");
  const random = mulberry32(params.seed);
  const between = (low: number, high: number) => low + random() * (high - low);
  const limits = effectiveLimits(params.profile, {
    scale: params.scale,
    cap: params.cap,
    costFloors: params.costFloors,
  });

  // The mock POS runs on replayed time.
  let now = 0;
  const pos = new MockToastProvider(new MemoryPosStore(), () => new Date(now * 1000));
  const restaurant = MOCK_RESTAURANT.guid;
  const menu = await pos.getMenu();
  const byGroup = (group: string) => menu.filter((item) => item.group === group);
  const pickFrom = (items: PosMenuItem[]) => items[Math.floor(random() * items.length)];
  const drink = () => {
    let roll = random();
    for (const [group, weight] of DRINK_GROUPS) {
      if (roll < weight) return pickFrom(byGroup(group));
      roll -= weight;
    }
    return pickFrom(byGroup("Draft Beer"));
  };

  // The manager features the first games of each kickoff window.
  const games = [...fixtures].sort((a, b) => a.kickoff - b.kickoff);
  const windows = [...new Set(games.map((game) => game.window))];
  const featured = windows.flatMap((label) =>
    games.filter((game) => game.window === label).slice(0, params.featuredPerWindow),
  );
  const windowKickoffs = windows.map(
    (label) => games.find((game) => game.window === label)!.kickoff,
  );

  const open = games[0].kickoff - 45 * MINUTE;
  const close = Math.max(...games.map((game) => game.end)) + 40 * MINUTE;

  // Guests arrive around the kickoffs, more of them for the windows with more games.
  const windowWeights = windows.map(
    (label) => featured.filter((game) => game.window === label).length,
  );
  const totalWeight = windowWeights.reduce((sum, weight) => sum + weight, 0);
  const guests: Guest[] = Array.from({ length: params.guests }, (_, index) => {
    let roll = random() * totalWeight;
    let windowIndex = 0;
    while (windowIndex < windowWeights.length - 1 && roll >= windowWeights[windowIndex]) {
      roll -= windowWeights[windowIndex];
      windowIndex += 1;
    }
    const arriveAt = Math.max(
      open,
      Math.round(windowKickoffs[windowIndex] + between(-40, 55) * MINUTE),
    );
    const plays = random() < params.playRate;
    return {
      name: `Guest ${index + 1}`,
      arriveAt,
      plays,
      check: null,
      nextOrderAt: arriveAt,
      pickAt: arriveAt + Math.round(between(2, 8)) * MINUTE,
      // Guests who are not playing stay an hour or two.
      leaveAt: plays ? Infinity : arriveAt + Math.round(between(55, 115)) * MINUTE,
      pick: null,
      finalLines: [],
      gone: false,
    };
  });

  /** Featured games a new pick can go on at time t: the ones being played, else the next to kick off. */
  const pickable = (t: number): FixtureGame[] => {
    const playing = featured.filter((game) => {
      const state = stateAt(game, t);
      return (
        (state.status === "live" && state.period <= params.lateCutoffPeriod) ||
        (state.status === "scheduled" && game.kickoff - t <= 30 * MINUTE)
      );
    });
    if (playing.length > 0) return playing;
    const upcoming = featured.filter((game) => game.kickoff > t);
    if (upcoming.length === 0) return [];
    const next = Math.min(...upcoming.map((game) => game.kickoff));
    return upcoming.filter((game) => game.kickoff === next);
  };

  const settle = async (guest: Guest) => {
    if (!guest.check) return;
    const check = (await pos.getCheck(restaurant, guest.check.orderId, guest.check.checkId))!;
    guest.finalLines = toLines(check);
    if (guest.pick && guest.pick.dFinal !== null && guest.pick.dFinal > 0) {
      const result = discountCheck({
        profile: params.profile,
        costFloors: params.costFloors,
        discount: guest.pick.dFinal,
        lines: guest.finalLines,
        pickedAt: guest.pick.pickedAt * 1000,
        maxCoveredCents: params.maxCoveredCents,
      });
      const lines = result.lines
        .filter((line) => line.discountCents > 0)
        .map((line) => ({ lineId: line.id, amountCents: line.discountCents }));
      if (lines.length > 0) {
        await pos.applyDiscount(restaurant, check.orderId, check.checkId, {
          name: "Pick & Pour",
          reference: guest.name,
          lines,
        });
      }
    }
    await pos.closeCheck(restaurant, check.orderId, check.checkId);
    guest.gone = true;
  };

  for (now = open; now <= close; now += MINUTE) {
    for (const guest of guests) {
      if (guest.gone || now < guest.arriveAt) continue;

      if (!guest.check) guest.check = await pos.openCheck(restaurant, guest.name);
      const { orderId, checkId } = guest.check;

      // A round: a drink, sometimes food with it.
      if (now >= guest.nextOrderAt && now < guest.leaveAt) {
        await pos.addItem(restaurant, orderId, checkId, drink().id);
        if (random() < 0.28) await pos.addItem(restaurant, orderId, checkId, pickFrom(byGroup("Food")).id);
        guest.nextOrderAt = now + Math.round(between(22, 38)) * MINUTE;
      }

      // The bartender takes the pick a few minutes after the guest sits down.
      if (guest.plays && !guest.pick && now >= guest.pickAt) {
        const options = pickable(now);
        if (options.length === 0) {
          // Nothing left to pick on: they become an ordinary guest.
          guest.plays = false;
          guest.leaveAt = now + Math.round(between(40, 90)) * MINUTE;
        } else {
          const game = options[Math.floor(random() * options.length)];
          const homeP = sideProbabilityAt(game, "home", now);
          const underdogSide: Side = homeP < 0.5 ? "home" : "away";
          const underdog = random() < params.underdogShare;
          const side: Side = underdog ? underdogSide : underdogSide === "home" ? "away" : "home";
          const pEntry = sideProbabilityAt(game, side, now);
          guest.pick = {
            game,
            side,
            underdog,
            pEntry,
            dWin: winDiscount(limits, pEntry),
            pickedAt: now,
            lockedAt: null,
            dFinal: null,
          };
        }
      }

      const pick = guest.pick;
      if (pick && pick.dFinal === null) {
        // Halftime: some of the players who are ahead lock in.
        const halftime = pick.game.breaks.find((entry) => entry.label === "Halftime");
        if (halftime && now >= halftime.start && now < halftime.start + MINUTE && pick.pickedAt < halftime.start) {
          const value = lockInDiscount(pick.dWin, pick.pEntry, sideProbabilityAt(pick.game, pick.side, now));
          if (value >= 0.01 && random() < params.lockInRate) {
            pick.dFinal = value;
            pick.lockedAt = now;
            guest.leaveAt = now + Math.round(between(20, 60)) * MINUTE;
          }
        }
        // The final whistle settles every pick still riding.
        if (pick.dFinal === null && now >= pick.game.end) {
          pick.dFinal = pick.game.winner === pick.side ? pick.dWin : 0;
          guest.leaveAt = now + Math.round(between(3, 12)) * MINUTE;
        }
      }

      if (now >= guest.leaveAt) await settle(guest);
    }
  }
  // Anyone still there at closing time settles up.
  for (const guest of guests) {
    if (!guest.gone && guest.check) {
      if (guest.pick && guest.pick.dFinal === null) guest.pick.dFinal = 0;
      await settle(guest);
    }
  }

  /* ------------------------------ Totals ------------------------------ */

  const players = guests.filter((guest) => guest.pick !== null);
  const discountFor = (guest: Guest, discount: number) =>
    discountCheck({
      profile: params.profile,
      costFloors: params.costFloors,
      discount,
      lines: guest.finalLines,
      pickedAt: guest.pick!.pickedAt * 1000,
      maxCoveredCents: params.maxCoveredCents,
    });

  let coveredCents = 0;
  let discountCents = 0;
  let unlimitedDiscountCents = 0;
  let limitedLines = 0;
  let lockedDiscountCents = 0;
  for (const guest of players) {
    const result = discountFor(guest, guest.pick!.dFinal ?? 0);
    coveredCents += result.coveredCents;
    discountCents += result.discountCents;
    unlimitedDiscountCents += result.unlimitedDiscountCents;
    limitedLines += result.lines.filter((line) => line.limitedBy !== null).length;
    if (guest.pick!.lockedAt !== null) lockedDiscountCents += result.discountCents;
  }

  // What each side of each game would have cost, holding the day's picks and tabs fixed.
  const hedges: SideHedge[] = [];
  let worst = lockedDiscountCents;
  let best = lockedDiscountCents;
  for (const game of featured) {
    const riding = players.filter(
      (guest) => guest.pick!.game.id === game.id && guest.pick!.lockedAt === null,
    );
    const exposure = { home: 0, away: 0 };
    const counts = { home: 0, away: 0 };
    for (const guest of riding) {
      const side = guest.pick!.side;
      exposure[side] += discountFor(guest, guest.pick!.dWin).discountCents;
      counts[side] += 1;
    }
    worst += Math.max(exposure.home, exposure.away);
    best += Math.min(exposure.home, exposure.away);

    for (const side of ["away", "home"] as const) {
      if (counts[side] === 0) continue;
      const price = sideProbabilityAt(game, side, game.kickoff);
      const contracts = Math.ceil(exposure[side] / 100);
      hedges.push({
        gameId: game.id,
        matchup: `${game.away.abbr} at ${game.home.abbr}`,
        side,
        team: side === "home" ? game.home.name : game.away.name,
        openPicks: counts[side],
        exposureCents: exposure[side],
        kickoffPrice: price,
        contracts,
        costCents: Math.round(contracts * price * 100),
        payoutCents: contracts * 100,
        won: game.winner === side,
      });
    }
  }

  const checks = (
    await Promise.all(
      guests
        .filter((guest) => guest.check)
        .map((guest) => pos.getCheck(restaurant, guest.check!.orderId, guest.check!.checkId)),
    )
  ).filter((check): check is PosCheck => check !== null);
  const barSalesCents = checks.reduce((sum, check) => sum + check.subtotalCents, 0);

  return {
    date: games[0].date,
    profile: params.profile.code,
    scale: limits.scale,
    cap: limits.cap,
    costFloors: params.costFloors,
    games: games.length,
    featuredGames: featured.length,
    guests: guests.filter((guest) => guest.check).length,
    players: players.length,
    barSalesCents,
    coveredCents,
    discountCents,
    unlimitedDiscountCents,
    effectiveDiscount: coveredCents > 0 ? discountCents / coveredCents : 0,
    discountShareOfSales: barSalesCents > 0 ? discountCents / barSalesCents : 0,
    picks: {
      won: players.filter((g) => g.pick!.lockedAt === null && g.pick!.game.winner === g.pick!.side).length,
      lost: players.filter((g) => g.pick!.lockedAt === null && g.pick!.game.winner !== g.pick!.side).length,
      lockedIn: players.filter((g) => g.pick!.lockedAt !== null).length,
      underdogs: players.filter((g) => g.pick!.underdog).length,
      favorites: players.filter((g) => !g.pick!.underdog).length,
    },
    limitedLines,
    worstCase: {
      discountCents: worst,
      effectiveDiscount: coveredCents > 0 ? worst / coveredCents : 0,
    },
    bestCase: { discountCents: best },
    hedges,
    hedgeTotals: {
      costCents: hedges.reduce((sum, hedge) => sum + hedge.costCents, 0),
      payoutCents: hedges.filter((hedge) => hedge.won).reduce((sum, hedge) => sum + hedge.payoutCents, 0),
      ridingDiscountCents: discountCents - lockedDiscountCents,
    },
    checks,
  };
}
