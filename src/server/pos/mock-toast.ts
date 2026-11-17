import { randomUUID } from "node:crypto";
import { ITEM_COSTS, MOCK_RESTAURANT, TOAST_MENU } from "./menu";
import {
  PosError,
  type PosCheck,
  type PosDiscountRequest,
  type PosLine,
  type PosMenuItem,
  type PosProvider,
} from "./provider";
import type {
  ToastAppliedDiscount,
  ToastCheck,
  ToastOrder,
  ToastSelection,
} from "./toast-types";

/** Where the mock keeps its orders: memory for tests and simulations, Postgres for the app. */
export interface MockPosStore {
  list(restaurantGuid: string): Promise<ToastOrder[]>;
  get(restaurantGuid: string, orderGuid: string): Promise<ToastOrder | null>;
  put(restaurantGuid: string, order: ToastOrder): Promise<void>;
}

export class MemoryPosStore implements MockPosStore {
  private orders = new Map<string, ToastOrder>();

  async list(restaurantGuid: string): Promise<ToastOrder[]> {
    return [...this.orders.entries()]
      .filter(([key]) => key.startsWith(`${restaurantGuid}:`))
      .map(([, order]) => order);
  }

  async get(restaurantGuid: string, orderGuid: string): Promise<ToastOrder | null> {
    return this.orders.get(`${restaurantGuid}:${orderGuid}`) ?? null;
  }

  async put(restaurantGuid: string, order: ToastOrder): Promise<void> {
    this.orders.set(`${restaurantGuid}:${order.guid}`, order);
  }
}

const cents = (dollars: number) => Math.round(dollars * 100);
const dollars = (amountCents: number) => Math.round(amountCents) / 100;

/** The discount this app's applications point at, as if configured in the Toast back end. */
const PICK_AND_POUR_DISCOUNT = {
  guid: "33333333-0000-4000-8000-000000000001",
  entityType: "Discount",
};

function recalculate(check: ToastCheck): void {
  let amount = 0;
  for (const selection of check.selections) {
    if (selection.voided) continue;
    const off = selection.appliedDiscounts.reduce((sum, applied) => sum + cents(applied.discountAmount), 0);
    const priceCents = Math.max(0, cents(selection.preDiscountPrice) - off);
    selection.price = dollars(priceCents);
    selection.tax = dollars(Math.round(priceCents * MOCK_RESTAURANT.taxRate));
    amount += priceCents;
  }
  check.amount = dollars(amount);
  check.taxAmount = dollars(Math.round(amount * MOCK_RESTAURANT.taxRate));
  check.totalAmount = dollars(amount + cents(check.taxAmount));
}

/** A Toast check as the app's neutral PosCheck (cents, costs attached). */
function toPosCheck(order: ToastOrder, check: ToastCheck): PosCheck {
  const lines: PosLine[] = check.selections.map((selection) => {
    const unitCost = ITEM_COSTS[selection.item.guid];
    return {
      id: selection.guid,
      itemId: selection.item.guid,
      name: selection.displayName,
      group: TOAST_MENU.find((item) => item.guid === selection.item.guid)?.menuGroup.name ?? "",
      quantity: selection.quantity,
      priceCents: cents(selection.preDiscountPrice),
      discountCents: cents(selection.preDiscountPrice) - cents(selection.price),
      costCents: unitCost === undefined ? null : cents(unitCost * selection.quantity),
      addedAt: selection.createdDate,
      voided: selection.voided,
    };
  });
  const live = lines.filter((line) => !line.voided);
  return {
    orderId: order.guid,
    checkId: check.guid,
    tabName: check.tabName ?? `Check ${check.displayNumber}`,
    displayNumber: check.displayNumber,
    openedAt: check.openedDate,
    closedAt: check.closedDate,
    open: check.closedDate === null && !check.voided && check.paymentStatus === "OPEN",
    subtotalCents: live.reduce((sum, line) => sum + line.priceCents, 0),
    discountCents: live.reduce((sum, line) => sum + line.discountCents, 0),
    lines,
  };
}

/**
 * A stand-in for Toast: keeps Toast-shaped orders in a store and answers the
 * PosProvider calls from them. It also has a few extra methods a real POS
 * would not need from us (opening checks, ringing in items), which the demo
 * buttons and the Sunday simulation use to play the part of the bartender.
 */
export class MockToastProvider implements PosProvider {
  readonly name = "mock-toast";

  constructor(
    private readonly store: MockPosStore,
    /** The mock's idea of "now", so a simulation can run on replayed time. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listOpenChecks(restaurantId: string): Promise<PosCheck[]> {
    const orders = await this.store.list(restaurantId);
    return orders
      .flatMap((order) => order.checks.map((check) => toPosCheck(order, check)))
      .filter((check) => check.open)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  async getCheck(restaurantId: string, orderId: string, checkId: string): Promise<PosCheck | null> {
    const order = await this.store.get(restaurantId, orderId);
    const check = order?.checks.find((candidate) => candidate.guid === checkId);
    return order && check ? toPosCheck(order, check) : null;
  }

  async applyDiscount(
    restaurantId: string,
    orderId: string,
    checkId: string,
    request: PosDiscountRequest,
  ): Promise<PosCheck> {
    const order = await this.store.get(restaurantId, orderId);
    const check = order?.checks.find((candidate) => candidate.guid === checkId);
    if (!order || !check) throw new PosError("That check is no longer in the POS.");
    if (check.closedDate !== null || check.paymentStatus !== "OPEN") {
      throw new PosError("That check is already closed in the POS.");
    }

    // Posting the same discount twice (a retry, a double tap) changes nothing.
    const already = check.selections.some((selection) =>
      selection.appliedDiscounts.some((applied) => applied.externalId === request.reference),
    );
    if (already) return toPosCheck(order, check);

    for (const line of request.lines) {
      if (line.amountCents <= 0) continue;
      const selection = check.selections.find((candidate) => candidate.guid === line.lineId);
      if (!selection || selection.voided) {
        throw new PosError("An item on the check changed. Refresh and try again.");
      }
      // Toast allows only one discount on a menu item selection.
      if (selection.appliedDiscounts.length > 0) {
        throw new PosError(`${selection.displayName} already has a discount on it in the POS.`);
      }
      if (line.amountCents > cents(selection.price)) {
        throw new PosError(`The discount on ${selection.displayName} is more than its price.`);
      }
      const applied: ToastAppliedDiscount = {
        guid: randomUUID(),
        entityType: "AppliedDiscount",
        name: request.name,
        discount: PICK_AND_POUR_DISCOUNT,
        discountAmount: dollars(line.amountCents),
        nonTaxDiscountAmount: dollars(line.amountCents),
        discountType: "OPEN_FIXED",
        discountPercent: null,
        processingState: null,
        externalId: request.reference,
      };
      selection.appliedDiscounts.push(applied);
      selection.modifiedDate = this.now().toISOString();
    }

    recalculate(check);
    order.modifiedDate = this.now().toISOString();
    await this.store.put(restaurantId, order);
    return toPosCheck(order, check);
  }

  async getMenu(): Promise<PosMenuItem[]> {
    return TOAST_MENU.map((item) => ({
      id: item.guid,
      name: item.name,
      group: item.menuGroup.name,
      priceCents: cents(item.price),
      costCents: ITEM_COSTS[item.guid] === undefined ? null : cents(ITEM_COSTS[item.guid]),
    }));
  }

  /* ----- Mock-only: the bartender's side of the POS ----- */

  /** Open a new tab, as a bartender would on the POS. */
  async openCheck(restaurantId: string, tabName: string): Promise<PosCheck> {
    const at = this.now();
    const existing = await this.store.list(restaurantId);
    const check: ToastCheck = {
      guid: randomUUID(),
      entityType: "Check",
      displayNumber: String(existing.length + 1),
      tabName,
      createdDate: at.toISOString(),
      modifiedDate: at.toISOString(),
      openedDate: at.toISOString(),
      closedDate: null,
      amount: 0,
      taxAmount: 0,
      totalAmount: 0,
      paymentStatus: "OPEN",
      voided: false,
      selections: [],
      appliedDiscounts: [],
    };
    const order: ToastOrder = {
      guid: randomUUID(),
      entityType: "Order",
      externalId: null,
      // A tab the bartender opened on the POS, not one created through the API.
      source: "In Store",
      displayNumber: String(existing.length + 1),
      createdDate: at.toISOString(),
      openedDate: at.toISOString(),
      modifiedDate: at.toISOString(),
      closedDate: null,
      businessDate: Number(at.toISOString().slice(0, 10).replace(/-/g, "")),
      server: null,
      table: null,
      numberOfGuests: 1,
      voided: false,
      checks: [check],
    };
    await this.store.put(restaurantId, order);
    return toPosCheck(order, check);
  }

  /** Ring an item in on an open check. */
  async addItem(
    restaurantId: string,
    orderId: string,
    checkId: string,
    itemId: string,
    quantity = 1,
  ): Promise<PosCheck> {
    const order = await this.store.get(restaurantId, orderId);
    const check = order?.checks.find((candidate) => candidate.guid === checkId);
    const item = TOAST_MENU.find((candidate) => candidate.guid === itemId);
    if (!order || !check || !item) throw new PosError("That check or item does not exist.");
    if (check.closedDate !== null) throw new PosError("That check is already closed.");
    const selection: ToastSelection = {
      guid: randomUUID(),
      entityType: "MenuItemSelection",
      item: { guid: item.guid, entityType: "MenuItem" },
      itemGroup: { guid: item.menuGroup.guid, entityType: "MenuGroup" },
      displayName: item.name,
      quantity,
      preDiscountPrice: dollars(cents(item.price) * quantity),
      price: dollars(cents(item.price) * quantity),
      tax: 0,
      voided: false,
      createdDate: this.now().toISOString(),
      modifiedDate: this.now().toISOString(),
      modifiers: [],
      appliedDiscounts: [],
    };
    check.selections.push(selection);
    recalculate(check);
    order.modifiedDate = this.now().toISOString();
    await this.store.put(restaurantId, order);
    return toPosCheck(order, check);
  }

  /** Close a check out (paid). */
  async closeCheck(restaurantId: string, orderId: string, checkId: string): Promise<void> {
    const order = await this.store.get(restaurantId, orderId);
    const check = order?.checks.find((candidate) => candidate.guid === checkId);
    if (!order || !check) return;
    const at = this.now().toISOString();
    check.closedDate = at;
    check.paymentStatus = "CLOSED";
    if (order.checks.every((candidate) => candidate.closedDate !== null)) order.closedDate = at;
    order.modifiedDate = at;
    await this.store.put(restaurantId, order);
  }

  /** The raw Toast-shaped order, for inspection and tests. */
  rawOrder(restaurantId: string, orderId: string): Promise<ToastOrder | null> {
    return this.store.get(restaurantId, orderId);
  }
}
