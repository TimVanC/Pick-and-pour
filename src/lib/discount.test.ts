import { describe, expect, it } from "vitest";
import {
  JURISDICTIONS,
  computeDiscount,
  coveredSpendCents,
  discountCents,
  effectiveLimits,
  impliedProbability,
  vigFreeProbability,
} from "./discount";

const pct = (value: number) => Math.round(value * 100);
const { NJ, NY } = JURISDICTIONS;

// Jets +500 vs. Chiefs -400, the PRD's running example.
const jets = vigFreeProbability(500, -400);
const chiefs = vigFreeProbability(-400, 500);

describe("win probability", () => {
  it("removes the bookmaker margin", () => {
    expect(pct(jets)).toBe(17);
    expect(pct(chiefs)).toBe(83);
    expect(jets + chiefs).toBeCloseTo(1);
  });
});

describe("jurisdiction table (PRD: Jurisdiction profiles)", () => {
  it("NJ default scale: Jets 62% off, Chiefs 13% off", () => {
    expect(pct(computeDiscount(NJ, {}, jets, jets, "won"))).toBe(62);
    expect(pct(computeDiscount(NJ, {}, chiefs, chiefs, "won"))).toBe(13);
  });

  it("NY: Jets 41% off, Chiefs 9% off, whatever the venue asks for", () => {
    expect(pct(computeDiscount(NY, {}, jets, jets, "won"))).toBe(41);
    expect(pct(computeDiscount(NY, {}, chiefs, chiefs, "won"))).toBe(9);
    expect(pct(computeDiscount(NY, { scale: 1, cap: 0.9 }, jets, jets, "won"))).toBe(41);
  });

  it("never exceeds the cap", () => {
    // Scale 1.0 would give 83%; the NJ blended cap holds it at 65%.
    expect(pct(computeDiscount(NJ, { scale: 1 }, jets, jets, "won"))).toBe(65);
    expect(effectiveLimits(NJ, { scale: 5, cap: 0.99 })).toEqual({ scale: 1, cap: 0.65 });
    expect(effectiveLimits(NJ, { scale: 0.1 }).scale).toBe(0.25);
  });
});

describe("worked example (PRD: Discount math, scale 1.0 with cost floors on)", () => {
  // The PRD's worked table reads each probability straight off a single line
  // (+500 = 17%, +450 = 18%) and allows up to 90% with item cost floors on.
  const floorsOn = { ...NJ, cap: 0.9 };
  const settings = { scale: 1, cap: 0.9 };
  const entry = impliedProbability(500);

  it("entry at kickoff: 83% off if they win", () => {
    expect(pct(computeDiscount(floorsOn, settings, entry, entry, "won"))).toBe(83);
  });

  it("lock-in grows as the line improves", () => {
    const lock = (pNow: number) =>
      computeDiscount(floorsOn, settings, entry, pNow, "open");
    expect(lock(impliedProbability(450))).toBeCloseTo(0.015, 3); // Q2 break: 1.5%
    expect(pct(lock(0.4))).toBe(23); // halftime, up 10
    expect(pct(lock(0.75))).toBe(58); // late 4th
    expect(pct(lock(1))).toBe(83); // final, Jets win
  });

  it("a line worse than entry locks in nothing, and a loss is full price", () => {
    expect(computeDiscount(floorsOn, settings, entry, 0.1, "open")).toBe(0);
    expect(computeDiscount(floorsOn, settings, entry, 0, "lost")).toBe(0);
  });
});

describe("dollars", () => {
  it("covers spend after the pick, up to the venue maximum", () => {
    expect(coveredSpendCents(6000, 0, 10000)).toBe(6000);
    expect(coveredSpendCents(6000, 2500, 10000)).toBe(3500);
    expect(coveredSpendCents(18000, 0, 10000)).toBe(10000);
    expect(coveredSpendCents(2000, 2500, 10000)).toBe(0);
  });

  it("rounds the discount to whole cents", () => {
    expect(discountCents(0.62, 6000)).toBe(3720);
    expect(discountCents(0.6207, 4599)).toBe(2855);
  });
});
