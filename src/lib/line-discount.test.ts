import { describe, expect, it } from "vitest";
import { JURISDICTIONS, effectiveLimits, maxCap, winDiscount } from "./discount";
import { discountCheck, type CheckLine } from "./line-discount";

const { NJ, NY } = JURISDICTIONS;
const PICKED_AT = 1_000_000;

function line(id: string, priceCents: number, costCents: number | null, minutesAfterPick = 1): CheckLine {
  return { id, name: id, priceCents, costCents, addedAt: PICKED_AT + minutesAfterPick * 60_000 };
}

const nj = (discount: number, lines: CheckLine[], maxCoveredCents = 10_000) =>
  discountCheck({ profile: NJ, costFloors: true, discount, lines, pickedAt: PICKED_AT, maxCoveredCents });
const ny = (discount: number, lines: CheckLine[], maxCoveredCents = 10_000) =>
  discountCheck({ profile: NY, costFloors: false, discount, lines, pickedAt: PICKED_AT, maxCoveredCents });

describe("cap with item cost floors (NJ)", () => {
  it("allows up to 90% once floors are on, 65% without", () => {
    expect(maxCap(NJ, false)).toBe(0.65);
    expect(maxCap(NJ, true)).toBe(0.9);
    expect(effectiveLimits(NJ, { cap: 0.9, costFloors: true }).cap).toBe(0.9);
    expect(effectiveLimits(NJ, { cap: 0.9, costFloors: false }).cap).toBe(0.65);
    // A +500 underdog at scale 1.0: 83% with floors on, held to 65% without.
    const p = 1 / 6;
    expect(winDiscount(effectiveLimits(NJ, { scale: 1, cap: 0.9, costFloors: true }), p)).toBeCloseTo(0.833, 3);
    expect(winDiscount(effectiveLimits(NJ, { scale: 1, cap: 0.9, costFloors: false }), p)).toBe(0.65);
  });

  it("never lets New York past 50%, floors or not", () => {
    expect(maxCap(NY, true)).toBe(0.5);
    expect(effectiveLimits(NY, { cap: 0.9, costFloors: true })).toEqual({ scale: 0.5, cap: 0.5 });
  });
});

describe("NJ per-item cost floor", () => {
  it("gives the full discount when every item stays above cost", () => {
    // $8 draft that costs $2.10, 62% off: pays $3.04, above cost.
    const result = nj(0.62, [line("Peroni", 800, 210)]);
    expect(result.lines[0]).toMatchObject({ discountCents: 496, limitedBy: null });
    expect(result.discountCents).toBe(496);
    expect(result.effectiveRate).toBeCloseTo(0.62, 2);
  });

  it("stops an item's discount at its cost", () => {
    // $22 Barolo that costs $9.90, 83% off would leave $3.74: below cost.
    const result = nj(0.83, [line("Barolo", 2200, 990)]);
    expect(result.lines[0]).toMatchObject({ discountCents: 1210, limitedBy: "cost-floor" });
    // The guest pays exactly cost, never less.
    expect(2200 - result.lines[0].discountCents).toBe(990);
    expect(result.unlimitedDiscountCents).toBe(1826);
  });

  it("applies the floor item by item, not on the blended check", () => {
    // 70% off: the vodka soda still clears its cost, the Barolo would not.
    const result = nj(0.7, [line("Vodka Soda", 900, 160), line("Barolo", 2200, 990)]);
    expect(result.lines.find((l) => l.id === "Vodka Soda")).toMatchObject({ discountCents: 630, limitedBy: null });
    expect(result.lines.find((l) => l.id === "Barolo")).toMatchObject({ discountCents: 1210, limitedBy: "cost-floor" });
    expect(result.discountCents).toBe(630 + 1210);
    // Blended, 70% of the $31 check would have been $21.70.
    expect(result.unlimitedDiscountCents).toBe(2170);
  });

  it("gives nothing off an item sold at or below cost", () => {
    const result = nj(0.5, [line("Loss leader", 500, 500), line("Below cost", 400, 600)]);
    expect(result.lines.map((l) => l.discountCents)).toEqual([0, 0]);
    expect(result.lines.every((l) => l.limitedBy === "cost-floor")).toBe(true);
  });

  it("falls back to the 65% blended limit for an item with no cost on file", () => {
    const result = nj(0.83, [line("Special", 1000, null)]);
    expect(result.lines[0]).toMatchObject({ discountCents: 650, limitedBy: "blended-cap" });
  });

  it("has no per-item limit when floors are off (manual entry)", () => {
    const result = discountCheck({
      profile: NJ,
      costFloors: false,
      discount: 0.65,
      lines: [line("Barolo", 2200, 990)],
      pickedAt: PICKED_AT,
      maxCoveredCents: 10_000,
    });
    expect(result.lines[0]).toMatchObject({ discountCents: 1430, limitedBy: null });
  });
});

describe("NY half-price rule", () => {
  it("passes a discount within the 50% cap untouched", () => {
    const result = ny(0.41, [line("Negroni", 1400, 330)]);
    expect(result.lines[0]).toMatchObject({ discountCents: 574, limitedBy: null });
  });

  it("holds every item at half its regular price even if asked for more", () => {
    const result = ny(0.8, [line("Negroni", 1400, 330), line("Pizza", 1700, 480)]);
    expect(result.lines.map((l) => l.discountCents)).toEqual([700, 850]);
    expect(result.lines.every((l) => l.limitedBy === "half-price")).toBe(true);
    expect(result.effectiveRate).toBe(0.5);
  });

  it("ignores item cost: the 50% rule is the only limit", () => {
    // Half price is below this item's cost; New York's rule is about price, not cost.
    const result = ny(0.5, [line("Barolo", 2200, 1500)]);
    expect(result.lines[0]).toMatchObject({ discountCents: 1100, limitedBy: null });
  });
});

describe("covered spend on a check", () => {
  it("covers only items rung in after the pick", () => {
    const result = nj(0.5, [line("Before", 1000, 200, -5), line("After", 1000, 200, 5)]);
    expect(result.lines.find((l) => l.id === "Before")).toMatchObject({ coveredCents: 0, discountCents: 0 });
    expect(result.lines.find((l) => l.id === "After")).toMatchObject({ coveredCents: 1000, discountCents: 500 });
    expect(result.coveredCents).toBe(1000);
  });

  it("stops at the venue's maximum covered spend, in the order items were rung in", () => {
    const result = nj(0.5, [line("A", 6000, 1000, 1), line("B", 6000, 1000, 2), line("C", 2000, 400, 3)]);
    expect(result.lines.map((l) => l.coveredCents)).toEqual([6000, 4000, 0]);
    expect(result.coveredCents).toBe(10_000);
    expect(result.discountCents).toBe(5000);
  });

  it("scales the cost floor to the covered part of a partly covered item", () => {
    // $60 item, $45 cost, only $40 covered: at most (60-45) x 40/60 = $10 off.
    const result = nj(0.9, [line("A", 6000, 1000, 1), line("Bottle", 6000, 4500, 2)]);
    expect(result.lines[1]).toMatchObject({ coveredCents: 4000, discountCents: 1000, limitedBy: "cost-floor" });
  });

  it("skips voided items and treats a zero or negative discount as nothing", () => {
    const voided = { ...line("Voided", 1000, 200), voided: true };
    expect(nj(0.5, [voided]).discountCents).toBe(0);
    expect(nj(0, [line("A", 1000, 200)]).discountCents).toBe(0);
    expect(nj(-1, [line("A", 1000, 200)]).discountCents).toBe(0);
    expect(nj(0.5, []).effectiveRate).toBeNull();
  });
});
