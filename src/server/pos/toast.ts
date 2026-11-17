import { PosError, type PosCheck, type PosMenuItem, type PosProvider } from "./provider";

/**
 * The real Toast integration. NOT IMPLEMENTED: this is a stub that marks where
 * the sandbox calls go. Every method throws until the TODOs are done.
 * Nothing here needs or stores credentials yet.
 *
 * What is needed before this can be written (see REPORT.md, "Open questions"):
 *  - Toast partner/sandbox access and API credentials (client id and secret),
 *    kept in environment variables, never in the repo.
 *  - Confirmation that a partner integration may add a discount to a check
 *    that was opened on the POS, and which discount types it may use.
 *  - A source for per-item cost (Toast's menu objects are not known to carry it).
 */
export class ToastProvider implements PosProvider {
  readonly name = "toast";

  // TODO(toast-sandbox): authenticate.
  //   POST {host}/authentication/v1/authentication/login with the client id
  //   and secret, cache the bearer token until it expires.
  // TODO(toast-sandbox): send `Toast-Restaurant-External-ID: <restaurant GUID>`
  //   on every request.

  async listOpenChecks(): Promise<PosCheck[]> {
    // TODO(toast-sandbox): GET /orders/v2/ordersBulk?businessDate=yyyymmdd
    //   (page + pageSize, max 100), keep checks whose paymentStatus is OPEN
    //   (there is no open-only filter), map with the same mapping
    //   MockToastProvider uses (dollars to cents, selections to lines).
    //   Needs the orders:read scope.
    // TODO(toast-sandbox): ordersBulk allows 5 requests a second per location
    //   (429 carries Retry-After). Toast recommends the order_updated webhook
    //   over polling.
    throw new PosError("The Toast integration is not connected yet.");
  }

  async getCheck(): Promise<PosCheck | null> {
    // TODO(toast-sandbox): GET /orders/v2/orders/{orderGuid}, pick the check by GUID.
    throw new PosError("The Toast integration is not connected yet.");
  }

  async applyDiscount(): Promise<PosCheck> {
    // TODO(toast-sandbox): for each line, POST
    //   /orders/v2/orders/{orderGuid}/checks/{checkGuid}/selections/{selectionGuid}/appliedDiscounts
    //   with an AppliedDiscount that references an item-level OPEN-AMOUNT
    //   discount the restaurant has configured in Toast (by GUID) and carries
    //   discountAmount in dollars. Needs the orders.discounts:write scope.
    //   Documented limits: the check must be OPEN, one discount per selection,
    //   open PERCENT discounts cannot be applied through the API.
    //   OPEN QUESTION: the docs do not say whether this works on a check that
    //   was opened on the POS (source "In Store") rather than through the API.
    //   Fallback: one check-level open-amount discount for the summed total
    //   (POST .../checks/{checkGuid}/appliedDiscounts).
    // TODO(toast-sandbox): make it idempotent (look for our reference on the
    //   check before posting, as the mock does).
    throw new PosError("The Toast integration is not connected yet.");
  }

  async getMenu(): Promise<PosMenuItem[]> {
    // TODO(toast-sandbox): GET /menus/v2/menus, flatten groups to items.
    // TODO(costs): join item costs from a CSV upload or an inventory source.
    throw new PosError("The Toast integration is not connected yet.");
  }
}
