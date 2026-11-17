import type { JurisdictionProfile } from "./discount";

/**
 * Line-by-line discount for a check that comes from a POS.
 * Money is integer cents. A "line" is one item on the check (already multiplied
 * by its quantity).
 */

export type CheckLine = {
  id: string;
  name: string;
  /** Regular (menu) price of the line before any discount. */
  priceCents: number;
  /** What the line costs the bar. Null when the cost is not known. */
  costCents: number | null;
  /** When the item was rung in (epoch milliseconds). */
  addedAt: number;
  voided?: boolean;
};

/** Why a line got less than the pick's full discount. */
export type LineLimit = "cost-floor" | "half-price" | "blended-cap";

export type LineDiscount = {
  id: string;
  name: string;
  priceCents: number;
  /** How much of the line the pick covers (0 for items rung in before the pick). */
  coveredCents: number;
  discountCents: number;
  limitedBy: LineLimit | null;
};

export type CheckDiscount = {
  lines: LineDiscount[];
  coveredCents: number;
  discountCents: number;
  /** What the pick's discount would have been with no per-item limits. */
  unlimitedDiscountCents: number;
  /** discountCents ÷ coveredCents. Null when nothing is covered. */
  effectiveRate: number | null;
};

export type CheckDiscountInput = {
  profile: JurisdictionProfile;
  /** True when item costs are loaded, so the NJ cost floor runs per item. */
  costFloors: boolean;
  /** The pick's final discount (a won pick's win discount, or a lock-in). */
  discount: number;
  lines: CheckLine[];
  /** Only items rung in at or after this time are covered (epoch milliseconds). */
  pickedAt: number;
  /** The venue's maximum covered spend. */
  maxCoveredCents: number;
};

/**
 * The most that can come off the covered part of one line.
 *
 * - New York: never below half the regular price.
 * - New Jersey with item costs: never below the item's cost. The floor is
 *   applied to the covered part in proportion, which is the cautious reading
 *   when a line is only partly covered.
 * - New Jersey, cost unknown for this item: the 65% blended limit instead.
 */
function lineLimit(
  input: CheckDiscountInput,
  line: CheckLine,
  coveredCents: number,
): { maxCents: number; reason: LineLimit } | null {
  const { profile } = input;
  if (profile.itemLimit === "halfPrice") {
    return { maxCents: Math.floor(coveredCents * 0.5), reason: "half-price" };
  }
  if (!input.costFloors) return null;
  if (line.costCents === null) {
    return { maxCents: Math.floor(coveredCents * profile.cap), reason: "blended-cap" };
  }
  const margin = Math.max(0, line.priceCents - line.costCents);
  const share = line.priceCents > 0 ? coveredCents / line.priceCents : 0;
  return { maxCents: Math.floor(margin * share), reason: "cost-floor" };
}

export function discountCheck(input: CheckDiscountInput): CheckDiscount {
  const discount = Math.min(1, Math.max(0, input.discount));
  let room = Math.max(0, input.maxCoveredCents);
  let coveredTotal = 0;
  let discountTotal = 0;
  let unlimitedTotal = 0;

  // Covered spend fills up in the order the items were rung in.
  const ordered = [...input.lines].sort((a, b) => a.addedAt - b.addedAt);
  const lines = ordered.map((line): LineDiscount => {
    const eligible = !line.voided && line.addedAt >= input.pickedAt && line.priceCents > 0;
    const covered = eligible ? Math.min(line.priceCents, room) : 0;
    room -= covered;

    const wanted = Math.round(discount * covered);
    const limit = covered > 0 ? lineLimit(input, line, covered) : null;
    const limited = limit !== null && wanted > limit.maxCents;
    const given = limited ? limit.maxCents : wanted;

    coveredTotal += covered;
    discountTotal += given;
    unlimitedTotal += wanted;
    return {
      id: line.id,
      name: line.name,
      priceCents: line.priceCents,
      coveredCents: covered,
      discountCents: given,
      limitedBy: limited ? limit.reason : null,
    };
  });

  return {
    lines,
    coveredCents: coveredTotal,
    discountCents: discountTotal,
    unlimitedDiscountCents: unlimitedTotal,
    effectiveRate: coveredTotal > 0 ? discountTotal / coveredTotal : null,
  };
}
