import { describe, expect, it } from "vitest";
import { MENU_GROUPS, MOCK_RESTAURANT, SEED_MENU } from "./menu";
import { MemoryPosStore, MockToastProvider } from "./mock-toast";
import { PosError } from "./provider";

const R = MOCK_RESTAURANT.guid;

async function setup() {
  let clock = new Date("2026-11-15T18:00:00Z");
  const pos = new MockToastProvider(new MemoryPosStore(), () => clock);
  const menu = await pos.getMenu();
  const item = (name: string) => menu.find((entry) => entry.name === name)!;
  const advance = (minutes: number) => {
    clock = new Date(clock.getTime() + minutes * 60_000);
  };
  return { pos, menu, item, advance };
}

describe("seed menu", () => {
  it("has about 40 items across the five groups, each priced above cost", () => {
    expect(SEED_MENU.length).toBe(40);
    for (const group of MENU_GROUPS) {
      expect(SEED_MENU.some((item) => item.group === group)).toBe(true);
    }
    for (const item of SEED_MENU) {
      expect(item.cost).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(item.cost);
    }
  });

  it("serves the menu in cents with a cost per item", async () => {
    const { item } = await setup();
    expect(item("Peroni Draft")).toMatchObject({ priceCents: 800, costCents: 210, group: "Draft Beer" });
  });
});

describe("MockToastProvider", () => {
  it("lists open checks with their lines, and drops them once closed", async () => {
    const { pos, item, advance } = await setup();
    const sam = await pos.openCheck(R, "Sam");
    advance(5);
    await pos.addItem(R, sam.orderId, sam.checkId, item("Peroni Draft").id, 2);
    await pos.addItem(R, sam.orderId, sam.checkId, item("Garlic Knots").id);
    const jo = await pos.openCheck(R, "Jo");

    const open = await pos.listOpenChecks(R);
    expect(open.map((check) => check.tabName)).toEqual(["Jo", "Sam"]);
    const check = open.find((entry) => entry.tabName === "Sam")!;
    expect(check.subtotalCents).toBe(1600 + 800);
    expect(check.lines[0]).toMatchObject({ name: "Peroni Draft", quantity: 2, priceCents: 1600, costCents: 420 });

    await pos.closeCheck(R, jo.orderId, jo.checkId);
    expect((await pos.listOpenChecks(R)).map((entry) => entry.tabName)).toEqual(["Sam"]);
  });

  it("keeps orders shaped like Toast: GUIDs, dollar amounts, In Store source", async () => {
    const { pos, item } = await setup();
    const check = await pos.openCheck(R, "Sam");
    await pos.addItem(R, check.orderId, check.checkId, item("Negroni").id);
    const order = (await pos.rawOrder(R, check.orderId))!;
    expect(order).toMatchObject({ entityType: "Order", source: "In Store", businessDate: 20261115 });
    expect(order.checks[0]).toMatchObject({ entityType: "Check", tabName: "Sam", paymentStatus: "OPEN", amount: 14 });
    expect(order.checks[0].selections[0]).toMatchObject({
      entityType: "MenuItemSelection",
      displayName: "Negroni",
      preDiscountPrice: 14,
      price: 14,
    });
    expect(order.checks[0].totalAmount).toBeCloseTo(14 * (1 + MOCK_RESTAURANT.taxRate), 2);
  });

  it("applies a discount line by line and retotals the check", async () => {
    const { pos, item } = await setup();
    const check = await pos.openCheck(R, "Sam");
    await pos.addItem(R, check.orderId, check.checkId, item("Negroni").id);
    const withItems = await pos.addItem(R, check.orderId, check.checkId, item("Margherita Pizza").id);
    const [negroni, pizza] = withItems.lines;

    const after = await pos.applyDiscount(R, check.orderId, check.checkId, {
      name: "Pick & Pour",
      reference: "pick-1",
      lines: [
        { lineId: negroni.id, amountCents: 574 },
        { lineId: pizza.id, amountCents: 697 },
      ],
    });
    expect(after.discountCents).toBe(574 + 697);
    expect(after.lines.map((line) => line.discountCents)).toEqual([574, 697]);

    const raw = (await pos.rawOrder(R, check.orderId))!.checks[0];
    expect(raw.amount).toBeCloseTo((1400 + 1700 - 574 - 697) / 100, 2);
    expect(raw.selections[0].appliedDiscounts[0]).toMatchObject({
      entityType: "AppliedDiscount",
      name: "Pick & Pour",
      discountType: "OPEN_FIXED",
      discountAmount: 5.74,
      externalId: "pick-1",
    });
  });

  it("does not double a discount posted twice", async () => {
    const { pos, item } = await setup();
    const check = await pos.openCheck(R, "Sam");
    const withItem = await pos.addItem(R, check.orderId, check.checkId, item("Negroni").id);
    const request = {
      name: "Pick & Pour",
      reference: "pick-1",
      lines: [{ lineId: withItem.lines[0].id, amountCents: 500 }],
    };
    await pos.applyDiscount(R, check.orderId, check.checkId, request);
    const again = await pos.applyDiscount(R, check.orderId, check.checkId, request);
    expect(again.discountCents).toBe(500);
  });

  it("refuses what Toast would refuse", async () => {
    const { pos, item } = await setup();
    const check = await pos.openCheck(R, "Sam");
    const withItem = await pos.addItem(R, check.orderId, check.checkId, item("Negroni").id);
    const lineId = withItem.lines[0].id;
    const discount = (reference: string, amountCents: number) => ({
      name: "Pick & Pour",
      reference,
      lines: [{ lineId, amountCents }],
    });

    // More than the item's price.
    await expect(pos.applyDiscount(R, check.orderId, check.checkId, discount("a", 5000))).rejects.toThrow(PosError);
    // Only one discount per menu item selection.
    await pos.applyDiscount(R, check.orderId, check.checkId, discount("b", 300));
    await expect(pos.applyDiscount(R, check.orderId, check.checkId, discount("c", 100))).rejects.toThrow(/already has a discount/);
    // The check must be open.
    await pos.closeCheck(R, check.orderId, check.checkId);
    await expect(pos.applyDiscount(R, check.orderId, check.checkId, discount("d", 100))).rejects.toThrow(/closed/);
    // Unknown check.
    await expect(pos.applyDiscount(R, "nope", "nope", discount("e", 100))).rejects.toThrow(PosError);
  });
});
