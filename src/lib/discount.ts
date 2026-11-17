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

/** NJ default profile without item costs: scale 0.75, 65% blended cap. */
export const NJ_DEFAULT_PROFILE: DiscountProfile = { scale: 0.75, cap: 0.65 };

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
