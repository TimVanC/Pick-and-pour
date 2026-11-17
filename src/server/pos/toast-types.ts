/**
 * Objects shaped like Toast's Orders API (v2). Only the fields this app uses.
 * Field names and types were checked against Toast's public API reference
 * (doc.toasttab.com/openapi/orders), not against a live sandbox: see REPORT.md
 * for what is confirmed and what is assumed.
 *
 * Toast conventions kept here on purpose: GUID strings, decimal dollar
 * amounts (not cents), ISO date strings, and `businessDate` as a yyyymmdd integer.
 */

export type ToastRef = { guid: string; entityType: string };

export type ToastAppliedDiscount = {
  guid: string;
  entityType: "AppliedDiscount";
  name: string;
  /** The discount configured in the Toast back end that this application used. */
  discount: ToastRef;
  /** Dollars taken off. */
  discountAmount: number;
  nonTaxDiscountAmount: number;
  discountType: "BOGO" | "PERCENT" | "FIXED" | "OPEN_PERCENT" | "OPEN_FIXED" | "FIXED_TOTAL";
  discountPercent: number | null;
  /** Used by loyalty discounts only; null for ordinary discounts like ours. */
  processingState: "PENDING_APPLIED" | "APPLIED" | "PENDING_VOID" | "VOID" | null;
  /** Our own reference (the pick id), so a retry never doubles a discount. */
  externalId: string | null;
};

export type ToastSelection = {
  guid: string;
  entityType: "MenuItemSelection";
  item: ToastRef;
  itemGroup: ToastRef;
  displayName: string;
  quantity: number;
  /** Dollars for the whole line before discounts. */
  preDiscountPrice: number;
  /** Dollars for the whole line after discounts. */
  price: number;
  tax: number;
  voided: boolean;
  createdDate: string;
  modifiedDate: string;
  modifiers: ToastSelection[];
  appliedDiscounts: ToastAppliedDiscount[];
};

export type ToastCheck = {
  guid: string;
  entityType: "Check";
  displayNumber: string;
  tabName: string | null;
  createdDate: string;
  modifiedDate: string;
  openedDate: string;
  closedDate: string | null;
  /** Dollars after discounts, before tax. */
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: "OPEN" | "PAID" | "CLOSED";
  voided: boolean;
  selections: ToastSelection[];
  /** Check-level discounts. This app puts its discounts on the selections instead. */
  appliedDiscounts: ToastAppliedDiscount[];
};

export type ToastOrder = {
  guid: string;
  entityType: "Order";
  externalId: string | null;
  /** Where the order came from: "In Store" for a tab opened on the POS, "API" for an integration. */
  source: string;
  displayNumber: string;
  createdDate: string;
  openedDate: string;
  modifiedDate: string;
  closedDate: string | null;
  /** yyyymmdd as an integer, e.g. 20261115. */
  businessDate: number;
  server: ToastRef | null;
  table: ToastRef | null;
  numberOfGuests: number;
  voided: boolean;
  checks: ToastCheck[];
};

export type ToastMenuItem = {
  guid: string;
  entityType: "MenuItem";
  name: string;
  menuGroup: { guid: string; name: string };
  /** Dollars. */
  price: number;
};
