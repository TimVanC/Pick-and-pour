/**
 * Discount math from the PRD ("Discount math and settlement").
 * Pure functions; probabilities are decimals (0 to 1), discounts are decimals too.
 * The marketing TV-board mockup uses these so its demo numbers are real.
 */

export type DiscountProfile = {
  /** House multiplier. */
  scale: number;
  /** Maximum discount. */
  cap: number;
};

export type JurisdictionCode = "NJ" | "NY";

/** What a jurisdiction allows. The math is the same everywhere; only these differ. */
export type JurisdictionProfile = {
  code: JurisdictionCode;
  name: string;
  scaleMin: number;
  scaleMax: number;
  scaleDefault: number;
  /** When true the manager cannot change the scale. */
  scaleLocked: boolean;
  /** Highest discount allowed. */
  cap: number;
  /** When true the manager cannot lower the cap either. */
  capLocked: boolean;
  costFloorRequired: boolean;
  /** Shown in the house rules on the guest page and table card. */
  rulesText: string;
};

export const JURISDICTIONS: Record<JurisdictionCode, JurisdictionProfile> = {
  NJ: {
    code: "NJ",
    name: "New Jersey",
    scaleMin: 0.25,
    scaleMax: 1,
    scaleDefault: 0.75,
    scaleLocked: false,
    // Safe blended limit without per-item costs (phase 1).
    cap: 0.65,
    capLocked: false,
    costFloorRequired: false,
    rulesText: "Maximum discount 65% under New Jersey rules.",
  },
  NY: {
    code: "NY",
    name: "New York",
    scaleMin: 0.5,
    scaleMax: 0.5,
    scaleDefault: 0.5,
    scaleLocked: true,
    cap: 0.5,
    capLocked: true,
    costFloorRequired: false,
    rulesText: "Maximum discount 50% under New York rules.",
  },
};

export function jurisdiction(code: string): JurisdictionProfile {
  return JURISDICTIONS[code as JurisdictionCode] ?? JURISDICTIONS.NJ;
}

/** The scale and cap actually in force: the venue's settings held inside the profile's limits. */
export function effectiveLimits(
  profile: JurisdictionProfile,
  venueSettings: { scale?: number; cap?: number },
): DiscountProfile {
  const scale = profile.scaleLocked
    ? profile.scaleDefault
    : Math.min(
        profile.scaleMax,
        Math.max(profile.scaleMin, venueSettings.scale ?? profile.scaleDefault),
      );
  const cap = profile.capLocked
    ? profile.cap
    : Math.min(profile.cap, Math.max(0, venueSettings.cap ?? profile.cap));
  return { scale, cap };
}

/** NJ default profile without item costs: scale 0.75, 65% blended cap. */
export const NJ_DEFAULT_PROFILE: DiscountProfile = effectiveLimits(
  JURISDICTIONS.NJ,
  {},
);

export type PickState = "open" | "locked" | "won" | "lost";

/**
 * The discount engine. One pure function for every screen:
 * - open:   what the pick could lock in for right now
 * - locked: the same formula, evaluated at the moment of the lock (pass that probability)
 * - won:    the full win discount
 * - lost:   nothing
 */
export function computeDiscount(
  profile: JurisdictionProfile,
  venueSettings: { scale?: number; cap?: number },
  pEntry: number,
  pNow: number,
  state: PickState,
): number {
  if (state === "lost") return 0;
  const dWin = winDiscount(effectiveLimits(profile, venueSettings), pEntry);
  if (state === "won") return dWin;
  return lockInDiscount(dWin, pEntry, pNow);
}

/** Spend the pick covers: what was rung up after the pick, up to the venue's maximum. */
export function coveredSpendCents(
  subtotalNowCents: number,
  subtotalAtPickCents: number,
  maxCoveredCents: number,
): number {
  return Math.max(
    0,
    Math.min(maxCoveredCents, subtotalNowCents - subtotalAtPickCents),
  );
}

/** Discount in whole cents, before tax. */
export function discountCents(discount: number, coveredCents: number): number {
  return Math.round(discount * coveredCents);
}

/** Implied probability of one side from American odds (still includes the margin). */
export function impliedProbability(americanOdds: number): number {
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/** Vig-free win probability of side A given both sides' American odds. */
export function vigFreeProbability(oddsA: number, oddsB: number): number {
  const qA = impliedProbability(oddsA);
  const qB = impliedProbability(oddsB);
  return qA / (qA + qB);
}

/** Discount if the side wins, fixed at entry. */
export function winDiscount(profile: DiscountProfile, pEntry: number): number {
  return Math.min(profile.cap, profile.scale * (1 - pEntry));
}

/** Lock-in discount at a break, from the live probability. Never negative. */
export function lockInDiscount(
  dWin: number,
  pEntry: number,
  pNow: number,
): number {
  return dWin * Math.max(0, (pNow - pEntry) / (1 - pEntry));
}

/** American line for a probability, rounded to the nearest 5. */
export function probabilityToLine(p: number): string {
  const clamped = Math.min(0.99, Math.max(0.01, p));
  const raw =
    clamped >= 0.5
      ? (-100 * clamped) / (1 - clamped)
      : (100 * (1 - clamped)) / clamped;
  const rounded = Math.round(raw / 5) * 5;
  if (Math.abs(rounded) <= 100) return rounded < 0 ? "−100" : "+100";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
