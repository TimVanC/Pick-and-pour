/**
 * The point-of-sale behind a venue. The app only talks to this interface, so
 * the mock Toast provider can be swapped for the real one without touching
 * the bartender screens or the discount math.
 *
 * Money is integer cents and times are ISO strings here, whatever the POS
 * itself uses (Toast uses decimal dollars).
 */

export type PosLine = {
  /** The POS's id for this line (a Toast selection GUID). */
  id: string;
  itemId: string;
  name: string;
  group: string;
  quantity: number;
  /** Regular price of the whole line, before discounts. */
  priceCents: number;
  /** Discounts already on this line. */
  discountCents: number;
  /** Cost of the whole line. Null when the POS has no cost for the item. */
  costCents: number | null;
  addedAt: string;
  voided: boolean;
};

export type PosCheck = {
  orderId: string;
  checkId: string;
  /** What the bartender called the tab ("Sam", "Seat 4"). */
  tabName: string;
  displayNumber: string;
  openedAt: string;
  closedAt: string | null;
  open: boolean;
  /** Sum of the regular prices of the lines that are not voided. */
  subtotalCents: number;
  /** Discounts already applied to the check. */
  discountCents: number;
  lines: PosLine[];
};

export type PosMenuItem = {
  id: string;
  name: string;
  group: string;
  priceCents: number;
  /** Null when the POS does not carry a cost for the item. */
  costCents: number | null;
};

export type PosDiscountRequest = {
  /** Shown on the check and the receipt. */
  name: string;
  /** Our own id for this discount (the pick id). Posting it twice must not double up. */
  reference: string;
  /** One amount per line. Lines that get nothing are left out. */
  lines: { lineId: string; amountCents: number }[];
};

export interface PosProvider {
  /** Stored in the venue's settings ("mock-toast", "toast"). */
  readonly name: string;
  /** Checks that are still open, newest first. */
  listOpenChecks(restaurantId: string): Promise<PosCheck[]>;
  getCheck(restaurantId: string, orderId: string, checkId: string): Promise<PosCheck | null>;
  /** Put a discount on an open check, line by line, and return the updated check. */
  applyDiscount(
    restaurantId: string,
    orderId: string,
    checkId: string,
    request: PosDiscountRequest,
  ): Promise<PosCheck>;
  getMenu(restaurantId: string): Promise<PosMenuItem[]>;
}

/** A POS refusal whose message is safe to show to the bartender. */
export class PosError extends Error {}
