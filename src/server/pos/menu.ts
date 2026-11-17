import type { ToastMenuItem } from "./toast-types";

/**
 * Seed data for the mock POS: a made-up New Jersey Italian bar.
 * Prices and costs are invented but in a realistic range (pour costs around
 * 20 to 30%, food around a third, a few high-cost items to exercise the NJ
 * per-item cost floor). Nothing here comes from a real venue.
 */
export const MOCK_RESTAURANT = {
  /** Sent to Toast as the Toast-Restaurant-External-ID header. */
  guid: "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b",
  name: "Lucia's Bar & Kitchen",
  location: "Montclair, NJ",
  /** NJ sales tax, used by the mock to total a check. */
  taxRate: 0.06625,
};

export type SeedItem = {
  name: string;
  group: string;
  /** Dollars, like Toast. */
  price: number;
  /** Dollars. What one unit costs the bar. Not part of Toast's menu objects. */
  cost: number;
};

export const MENU_GROUPS = [
  "Draft Beer",
  "Bottles & Cans",
  "Wine by the Glass",
  "Cocktails",
  "Food",
] as const;

export const SEED_MENU: SeedItem[] = [
  // Draft beer
  { name: "Peroni Draft", group: "Draft Beer", price: 8, cost: 2.1 },
  { name: "Moretti Draft", group: "Draft Beer", price: 8, cost: 2.05 },
  { name: "Kane Head High IPA", group: "Draft Beer", price: 9, cost: 2.7 },
  { name: "Carton Boat Beer", group: "Draft Beer", price: 9, cost: 2.6 },
  { name: "Yuengling Lager", group: "Draft Beer", price: 6, cost: 1.3 },
  { name: "Guinness", group: "Draft Beer", price: 9, cost: 2.5 },
  { name: "Blue Moon", group: "Draft Beer", price: 7, cost: 1.75 },
  { name: "Miller Lite Draft", group: "Draft Beer", price: 5, cost: 1.05 },
  // Bottles and cans
  { name: "Bud Light Bottle", group: "Bottles & Cans", price: 5, cost: 1.35 },
  { name: "Coors Light Bottle", group: "Bottles & Cans", price: 5, cost: 1.35 },
  { name: "Corona Extra", group: "Bottles & Cans", price: 6.5, cost: 1.9 },
  { name: "Heineken", group: "Bottles & Cans", price: 6.5, cost: 1.95 },
  { name: "High Noon Seltzer", group: "Bottles & Cans", price: 8, cost: 2.9 },
  { name: "Peroni 0.0 (non-alcoholic)", group: "Bottles & Cans", price: 6, cost: 1.8 },
  // Wine by the glass
  { name: "House Chianti", group: "Wine by the Glass", price: 10, cost: 2.4 },
  { name: "Pinot Grigio", group: "Wine by the Glass", price: 11, cost: 2.8 },
  { name: "Montepulciano d'Abruzzo", group: "Wine by the Glass", price: 12, cost: 3.2 },
  { name: "Prosecco", group: "Wine by the Glass", price: 11, cost: 2.9 },
  { name: "Super Tuscan", group: "Wine by the Glass", price: 16, cost: 5.6 },
  { name: "Barolo", group: "Wine by the Glass", price: 22, cost: 9.9 },
  { name: "Sauvignon Blanc", group: "Wine by the Glass", price: 12, cost: 3.1 },
  // Cocktails
  { name: "Aperol Spritz", group: "Cocktails", price: 13, cost: 2.9 },
  { name: "Negroni", group: "Cocktails", price: 14, cost: 3.3 },
  { name: "Espresso Martini", group: "Cocktails", price: 15, cost: 3.4 },
  { name: "Old Fashioned", group: "Cocktails", price: 14, cost: 3.1 },
  { name: "Margarita", group: "Cocktails", price: 13, cost: 2.7 },
  { name: "Limoncello Drop", group: "Cocktails", price: 13, cost: 2.6 },
  { name: "Vodka Soda", group: "Cocktails", price: 9, cost: 1.6 },
  { name: "Italian Mule", group: "Cocktails", price: 12, cost: 2.4 },
  { name: "Reserve Bourbon Pour", group: "Cocktails", price: 18, cost: 8.6 },
  // Food
  { name: "Garlic Knots", group: "Food", price: 8, cost: 1.9 },
  { name: "Fried Calamari", group: "Food", price: 16, cost: 5.4 },
  { name: "Mozzarella Sticks", group: "Food", price: 11, cost: 3.1 },
  { name: "Wings (10)", group: "Food", price: 16, cost: 6.4 },
  { name: "Meatball Sliders", group: "Food", price: 14, cost: 4.6 },
  { name: "Margherita Pizza", group: "Food", price: 17, cost: 4.8 },
  { name: "Pepperoni Pizza", group: "Food", price: 19, cost: 5.7 },
  { name: "Chicken Parm Sandwich", group: "Food", price: 17, cost: 5.9 },
  { name: "Rigatoni alla Vodka", group: "Food", price: 21, cost: 6.1 },
  { name: "Veal Parmigiana", group: "Food", price: 29, cost: 13.2 },
];

/** Stable GUID-shaped ids so the seed is the same on every run. */
function guidFor(kind: "item" | "group", index: number): string {
  const tail = String(index + 1).padStart(12, "0");
  return `${kind === "item" ? "11111111" : "22222222"}-0000-4000-8000-${tail}`;
}

const groupGuids = new Map(
  MENU_GROUPS.map((name, index) => [name as string, guidFor("group", index)]),
);

/** The seed menu as Toast menu items. */
export const TOAST_MENU: ToastMenuItem[] = SEED_MENU.map((item, index) => ({
  guid: guidFor("item", index),
  entityType: "MenuItem",
  name: item.name,
  menuGroup: { guid: groupGuids.get(item.group) ?? "", name: item.group },
  price: item.price,
}));

/**
 * Cost per item in dollars, keyed by item GUID. Toast's menu objects are not
 * known to carry cost, so costs live beside the menu (in real life: a CSV or
 * an inventory integration).
 */
export const ITEM_COSTS: Record<string, number> = Object.fromEntries(
  SEED_MENU.map((item, index) => [guidFor("item", index), item.cost]),
);
