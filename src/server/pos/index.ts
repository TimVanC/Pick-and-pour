import { db } from "../db";
import { MOCK_RESTAURANT, TOAST_MENU } from "./menu";
import { MockToastProvider, type MockPosStore } from "./mock-toast";
import type { PosCheck, PosProvider } from "./provider";
import type { ToastOrder } from "./toast-types";

/** The mock POS's orders, kept in Postgres so every request sees the same checks. */
class NeonPosStore implements MockPosStore {
  async list(restaurantGuid: string): Promise<ToastOrder[]> {
    const rows = await db()`
      select data from mock_pos_orders
      where restaurant_guid = ${restaurantGuid} and updated_at > now() - interval '24 hours'
    `;
    return rows.map((row) => row.data as ToastOrder);
  }

  async get(restaurantGuid: string, orderGuid: string): Promise<ToastOrder | null> {
    const rows = await db()`
      select data from mock_pos_orders
      where restaurant_guid = ${restaurantGuid} and order_guid = ${orderGuid}
    `;
    return rows[0] ? (rows[0].data as ToastOrder) : null;
  }

  async put(restaurantGuid: string, order: ToastOrder): Promise<void> {
    await db()`
      insert into mock_pos_orders (restaurant_guid, order_guid, data, updated_at)
      values (${restaurantGuid}, ${order.guid}, ${JSON.stringify(order)}::jsonb, now())
      on conflict (restaurant_guid, order_guid)
      do update set data = excluded.data, updated_at = now()
    `;
  }
}

export type VenuePos = {
  provider: PosProvider;
  /** The restaurant's id in the POS. Each venue gets its own copy of the mock bar. */
  restaurantId: string;
  /** Set when the provider is the mock, which can also play the bartender's side. */
  mock: MockToastProvider | null;
};

/** The POS connected to a venue, or null when the venue enters tabs by hand. */
export function posForVenue(venue: { id: string; settings: { posProvider: string } }): VenuePos | null {
  if (venue.settings.posProvider !== "mock-toast") return null;
  const mock = new MockToastProvider(new NeonPosStore());
  return { provider: mock, restaurantId: `${MOCK_RESTAURANT.guid}:${venue.id}`, mock };
}

const SAMPLE_TABS = ["Sam", "Jo", "Alex", "Priya", "Marcus", "Dana", "Luis", "Kim"];

function randomItem(group?: string) {
  const pool = group ? TOAST_MENU.filter((item) => item.menuGroup.name === group) : TOAST_MENU;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Demo button: open a handful of tabs on the mock POS, each with a first round. */
export async function openSampleChecks(pos: VenuePos): Promise<void> {
  if (!pos.mock) return;
  const open = await pos.provider.listOpenChecks(pos.restaurantId);
  const taken = new Set(open.map((check) => check.tabName));
  const names = SAMPLE_TABS.filter((name) => !taken.has(name)).slice(0, 6);
  for (const name of names) {
    const check = await pos.mock.openCheck(pos.restaurantId, name);
    await pos.mock.addItem(pos.restaurantId, check.orderId, check.checkId, randomItem("Draft Beer").guid);
  }
}

/** Demo button: ring a round in on a mock check (a drink, sometimes food too). */
export async function addSampleRound(pos: VenuePos, check: PosCheck): Promise<void> {
  if (!pos.mock) return;
  const drinks = ["Draft Beer", "Cocktails", "Wine by the Glass", "Bottles & Cans"];
  const drink = randomItem(drinks[Math.floor(Math.random() * drinks.length)]);
  await pos.mock.addItem(pos.restaurantId, check.orderId, check.checkId, drink.guid);
  if (Math.random() < 0.4) {
    await pos.mock.addItem(pos.restaurantId, check.orderId, check.checkId, randomItem("Food").guid);
  }
}
