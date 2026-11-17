import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JURISDICTIONS } from "@/lib/discount";
import { loadFixtureIndex, loadSunday } from "@/server/odds/replay-core";
import { DEFAULT_SUNDAY, simulateSunday, type SundayResult } from "./sunday";

/**
 * Integration test: a whole game day through the mock POS against every
 * recorded Sunday, for New Jersey and New York. Besides the checks below it
 * writes the numbers to fixtures/sim-results.json, which REPORT.md quotes.
 *
 *   npm run sim     (runs only this file, prints the table)
 */

const index = loadFixtureIndex();
const sundays = index.sundays.map((sunday) => sunday.date);

const profiles: {
  profile: (typeof JURISDICTIONS)[keyof typeof JURISDICTIONS];
  costFloors: boolean;
  cap?: number;
  scale?: number;
  label: string;
}[] = [
  // The default: scale 0.75, POS connected so the NJ cap may go to 90%.
  { profile: JURISDICTIONS.NJ, costFloors: true, cap: 0.9, label: "NJ default (POS, floors on)" },
  // The PRD's "83% off if they win" setting: scale 1.0 with per-item cost floors.
  { profile: JURISDICTIONS.NJ, costFloors: true, cap: 0.9, scale: 1, label: "NJ scale 1.0 (POS, floors on)" },
  // Manual tab entry: no item costs, so the 65% blended cap applies.
  { profile: JURISDICTIONS.NJ, costFloors: false, label: "NJ default (manual, 65% cap)" },
  // New York: scale and cap fixed at 0.5, half-price rule per item.
  { profile: JURISDICTIONS.NY, costFloors: true, label: "NY (fixed 50%)" },
];

const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const results: (SundayResult & { label: string })[] = [];

describe("a full Sunday at the mock bar", () => {
  for (const setup of profiles) {
    for (const date of sundays) {
      it(`${setup.label} ${date}`, async () => {
        const result = await simulateSunday(loadSunday(date), {
          ...DEFAULT_SUNDAY,
          profile: setup.profile,
          costFloors: setup.costFloors,
          cap: setup.cap,
          scale: setup.scale,
        });
        results.push({ ...result, label: setup.label });

        // The bar had a day.
        expect(result.guests).toBe(DEFAULT_SUNDAY.guests);
        expect(result.players).toBeGreaterThan(result.guests * 0.15);
        expect(result.players).toBeLessThan(result.guests * 0.45);
        expect(result.barSalesCents).toBeGreaterThan(0);

        // Every pick ended one way: won, lost or locked in.
        const { won, lost, lockedIn } = result.picks;
        expect(won + lost + lockedIn).toBe(result.players);

        // Money adds up and stays inside the rules.
        expect(result.discountCents).toBeLessThanOrEqual(result.unlimitedDiscountCents);
        expect(result.effectiveDiscount).toBeLessThanOrEqual(result.cap + 1e-9);
        expect(result.worstCase.discountCents).toBeGreaterThanOrEqual(result.discountCents);
        expect(result.bestCase.discountCents).toBeLessThanOrEqual(result.discountCents);

        // What the POS holds matches what the simulation thinks it posted.
        const posted = result.checks.reduce((sum, check) => sum + check.discountCents, 0);
        expect(posted).toBe(result.discountCents);
        // Every check is closed, and nothing was discounted below cost in NJ with floors on.
        for (const check of result.checks) {
          expect(check.open).toBe(false);
          for (const line of check.lines) {
            expect(line.discountCents).toBeLessThanOrEqual(line.priceCents);
            if (setup.profile.code === "NJ" && setup.costFloors && line.costCents !== null) {
              expect(line.priceCents - line.discountCents).toBeGreaterThanOrEqual(line.costCents);
            }
            if (setup.profile.code === "NY") {
              expect(line.discountCents * 2).toBeLessThanOrEqual(line.priceCents);
            }
          }
        }

        // A hedge on a side pays its exposure when that side wins.
        for (const hedge of result.hedges) {
          expect(hedge.payoutCents).toBeGreaterThanOrEqual(hedge.exposureCents);
          expect(hedge.costCents).toBeLessThan(hedge.payoutCents);
        }
      });
    }
  }

  it("is the same every time for the same seed", async () => {
    const fixtures = loadSunday(sundays[0]);
    const a = await simulateSunday(fixtures, { ...DEFAULT_SUNDAY, profile: JURISDICTIONS.NJ, costFloors: true });
    const b = await simulateSunday(fixtures, { ...DEFAULT_SUNDAY, profile: JURISDICTIONS.NJ, costFloors: true });
    expect(a.discountCents).toBe(b.discountCents);
    expect(a.barSalesCents).toBe(b.barSalesCents);
  });

  it("gives more away when guests take the underdog, less when they take favorites", async () => {
    const fixtures = loadSunday(sundays[0]);
    const base = { ...DEFAULT_SUNDAY, profile: JURISDICTIONS.NJ, costFloors: true };
    const underdogs = await simulateSunday(fixtures, { ...base, underdogShare: 1 });
    const favorites = await simulateSunday(fixtures, { ...base, underdogShare: 0 });
    // Worst case scales with the win discounts, which are far larger on underdogs.
    expect(underdogs.worstCase.discountCents).toBeGreaterThan(favorites.worstCase.discountCents);
  });

  it("writes the numbers for the report", () => {
    const out = join(process.cwd(), "fixtures", "sim-results.json");
    mkdirSync(join(process.cwd(), "fixtures"), { recursive: true });
    const rows = results.map((result) => {
      const { hedges, ...rest } = result;
      return { ...rest, checks: undefined, hedges: hedges.length };
    });
    writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), params: DEFAULT_SUNDAY, rows }, null, 2));

    const header = ["profile", "date", "players", "sales", "covered", "discounts", "eff %", "of sales", "worst", "hedge cost", "hedge paid"];
    const table = results.map((r) => [
      r.label,
      r.date,
      String(r.players),
      dollars(r.barSalesCents),
      dollars(r.coveredCents),
      dollars(r.discountCents),
      pct(r.effectiveDiscount),
      pct(r.discountShareOfSales),
      dollars(r.worstCase.discountCents),
      dollars(r.hedgeTotals.costCents),
      dollars(r.hedgeTotals.payoutCents),
    ]);
    const widths = header.map((_, i) => Math.max(header[i].length, ...table.map((row) => row[i].length)));
    const line = (row: string[]) => row.map((cell, i) => cell.padEnd(widths[i])).join("  ");
    console.log(["", line(header), ...table.map(line), ""].join("\n"));
    expect(rows.length).toBe(profiles.length * sundays.length);
  });
});
