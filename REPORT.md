# Version 2 report: Toast mock, Kalshi replay and the Sunday test harness

Branch `feature/v2-toast-mock`, not merged. Nothing was deployed and no secrets were added. Toast is mocked; Kalshi data came from its public market-data API; nflverse play-by-play is public.

## What was built

### 1. POS abstraction

- `src/server/pos/provider.ts`: the `PosProvider` interface (`listOpenChecks`, `getCheck`, `applyDiscount`, `getMenu`) and the neutral `PosCheck` / `PosLine` / `PosMenuItem` shapes the app uses (integer cents, ISO times).
- `src/server/pos/toast-types.ts`: `ToastOrder`, `ToastCheck`, `ToastSelection`, `ToastAppliedDiscount` and `ToastMenuItem`, shaped like Toast's Orders API v2 (GUIDs, decimal dollars, `businessDate` as yyyymmdd, `source: "In Store"`). Field names and types were checked against Toast's public API reference, not a sandbox.
- `src/server/pos/mock-toast.ts`: `MockToastProvider`. Keeps Toast-shaped orders in a store (memory for tests and simulations, Postgres table `mock_pos_orders` for the app), answers the four provider calls, and enforces what Toast's docs say it enforces: the check must be `OPEN`, one discount per menu item selection, a discount cannot exceed the line price, and a re-post with the same reference changes nothing. It also plays the bartender's side (`openCheck`, `addItem`, `closeCheck`), which a real POS would not need from us.
- `src/server/pos/toast.ts`: `ToastProvider` stub. Every method throws; the TODOs name the endpoints, scopes and limits found in the docs.
- `src/server/pos/menu.ts`: the fake NJ Italian bar "Lucia's Bar & Kitchen" (Montclair): 40 items in five groups (draft, bottles and cans, wine by the glass, cocktails, food) with prices and per-item costs. Costs live beside the menu, not inside the Toast objects, because Toast's menu objects have no cost field.

### 2. Line-by-line settlement

- `src/lib/line-discount.ts`: `discountCheck()`. Covered spend fills up with items rung in after the pick, in order, up to the venue maximum. Each line then gets the pick's discount, limited per item by the jurisdiction profile:
  - New Jersey with item costs loaded: an item is never discounted below its cost (the floor scales with the covered share of a partly covered line). An item with no cost on file falls back to the 65% blended limit.
  - New York: never below half the regular price, whatever the cost.
  - Manual entry (no POS): no per-item limit; the blended cap does the work as in phase 1.
- `src/lib/discount.ts`: the jurisdiction profiles gained `itemLimit` ("cost" or "halfPrice") and `capWithItemLimits` (NJ 90% with floors on, 65% without; NY stays at 50%). `effectiveLimits()` takes `costFloors`.
- Bartender app (`/app`), when the venue's "Tabs come from" setting is the mock POS:
  - New pick, step 3 shows the POS's open checks (name, check number, items, subtotal) to attach the pick to with one tap. "Not on the list? Enter the tab by hand" keeps the phase 1 flow as the fallback.
  - The pick screen shows the POS check: every line, which ones the pick covers, which were limited and why, covered spend, and what will come off. Once the pick is locked in or has won, "Post $X to the check" sends the per-line amounts through `applyDiscount` and records the lines on the pick for the audit log. A lost pick closes at full price as before.
  - Manager, Settings: "Tabs come from" (typed in, or Toast open checks via the mock). Turning the POS on raises the NJ cap ceiling to 90% and explains the cost floor.
  - Manager, Games: "Open sample tabs" seeds six tabs on the mock POS; "Ring in a round" on a pick adds a drink (and sometimes food) so settlement has something to work with.
- API: `GET/POST /api/app/pos` (open checks, settlement preview per pick, apply, seed, round). Migration `db/migrations/0003_pos.sql` adds `pos_order_id`, `pos_check_id` and `discount_lines` to picks and the `mock_pos_orders` table.

### 3. Kalshi replay

- `scripts/fetch-fixtures.mjs` (`npm run fixtures:fetch`): pulls `KXNFLGAME` events and markets from Kalshi's public API with 1-minute candlesticks (live endpoint for recent markets, `/historical/.../candlesticks` for settled ones), the nflverse 2026 play-by-play (`time_of_day` per play) and schedule, matches them by date and team codes, and writes `fixtures/kalshi/index.json` plus one file per game. `--synthetic` generates deterministic games in the same shape without the network; the script also falls back per game and records it in `source` / `breaksSource`.
- Result: **49 games across 4 Sundays (Oct 25, Nov 1, Nov 8, Nov 15 2026), all with real Kalshi prices and real nflverse period and break times.** 1.2 MB on disk. The pregame favorite won 39 of 49. Price per minute is the mid of the yes bid/ask close, else the last trade, forward-filled and clamped to 0.01..0.99. Clock seconds between plays are interpolated.
- `src/server/odds/replay-core.ts`: loads fixtures and answers "state at time t" (period, clock, score, break) and "home win probability at time t".
- `src/server/odds/kalshi-replay.ts`: `KalshiReplayOddsProvider`, registered beside the simulated feed. Maps real time to fixture time at an adjustable speed, turns the Kalshi price into a moneyline pair with a bookmaker margin (the app de-vigs it back), stores the raw price in `books_raw`, and never skips a quarter break even at 240×.
- Manager, Games: "Replay a past Sunday" picks the Sunday and the speed (10×, 30×, 60×). Every game of that day goes on the schedule; the first four of each kickoff window are featured.

### 4. Sunday simulation

- `src/sim/sunday.ts`: `simulateSunday(fixtures, params)`. 140 guests arrive around the kickoffs, open tabs on the in-memory mock POS and order rounds; 30% play; picks split by `underdogShare`; at halftime 35% of players whose side is ahead lock in; everything else settles at the final; each settlement runs `discountCheck()` and posts the lines to the mock POS. Deterministic for a seed. Outputs players, covered spend, discounts, effective discount, discount as a share of all bar sales, worst and best case for the same picks and tabs, and a per-side Kalshi hedge (contracts to cover the exposure, their cost at the kickoff price, what they paid).
- `src/sim/sunday.test.ts` (`npm run sim`): runs every recorded Sunday for NJ default, NJ scale 1.0, NJ manual (65% cap) and NY, checks the invariants, and writes `fixtures/sim-results.json`.

## Test results

`npm test`: 5 files, 62 tests, all passing. `npm run lint`: clean. `npx tsc --noEmit`: clean. `npm run build`: compiles.

| File | What it covers |
| --- | --- |
| `src/lib/discount.test.ts` (9) | Vig-free probability, the PRD jurisdiction table (NJ 62%/13%, NY 41%/9%), caps, the PRD worked example (83% entry, 1.5% → 23% → 58% → 83% lock-ins, 0% when the line moves against), covered spend and rounding |
| `src/lib/line-discount.test.ts` (15) | NJ cap 65% vs 90% with floors; NJ cost floor per item (full discount above cost, stop at cost, item by item not blended, at-or-below-cost items, no cost on file → 65%, floors off → no limit); NY half price (within cap, held at 50%, cost ignored); covered spend (only after the pick, max covered in ring-in order, partial-line floor scaling, voided and zero/negative discounts) |
| `src/server/pos/mock-toast.test.ts` (7) | 40-item seed above cost; open checks list and close; Toast-shaped orders (GUIDs, dollars, In Store); line-by-line discount and retotal; idempotent re-post; refusals (over price, second discount on a line, closed check, unknown check) |
| `src/server/odds/replay.test.ts` (10) | Fixture integrity (3+ Sundays, 10+ games each, 60 s candles, breaks in order and inside the game, path-escape refused); state at a moment (scheduled/live/final, breaks and the period they follow, score never goes backwards); probability bounds; the replay provider's time mapping, live moneylines, final settlement and no skipped breaks at 240× |
| `src/sim/sunday.test.ts` (21) | Full Sunday ×4 ×4 profiles: 15–45% of guests play; every pick won, lost or locked; discounts ≤ unlimited ≤ worst case; effective ≤ cap; POS totals equal the simulation's; every check closed; no NJ line below cost; no NY line below half price; hedges pay ≥ exposure; same seed → same result; underdog-heavy days have a bigger worst case |

## Simulation numbers

140 guests, 30% play, picks split 50/50 favorite/underdog, 35% of players who are ahead lock in at halftime, $100 max covered spend, late entry until the end of Q3, four games featured per window. Dollar figures are before tax. "Covered" is the spend the picks covered, win or lose. "Worst" is the same picks and tabs if every game had gone the costlier way for the bar. "Hedge" is buying, at the kickoff Kalshi price, enough $1 contracts on every side with exposure to cover that side's payout; "paid" is what those contracts returned given the real results.

### New Jersey, default scale 0.75, POS connected (cap up to 90%, cost floors on)

| Sunday | Players | Bar sales | Covered | Discounts | Effective | Of sales | Worst | Hedge cost | Hedge paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-15 | 48 | $8,360 | $2,969 | $251 | 8.5% | 3.0% | $883 | $407 | $189 |
| 2026-11-08 | 48 | $9,382 | $3,813 | $344 | 9.0% | 3.7% | $1,168 | $531 | $297 |
| 2026-11-01 | 48 | $9,290 | $3,466 | $427 | 12.3% | 4.6% | $771 | $465 | $368 |
| 2026-10-25 | 48 | $9,162 | $3,641 | $295 | 8.1% | 3.2% | $1,068 | $554 | $227 |

### New Jersey, scale 1.0, POS connected (the PRD's "83% off if they win" setting)

| Sunday | Players | Bar sales | Covered | Discounts | Effective | Of sales | Worst | Lines limited by cost | Hedge cost | Hedge paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-15 | 48 | $8,360 | $2,969 | $335 | 11.3% | 4.0% | $1,090 | 0 | $517 | $253 |
| 2026-11-08 | 48 | $9,355 | $3,802 | $456 | 12.0% | 4.9% | $1,390 | 0 | $660 | $393 |
| 2026-11-01 | 48 | $9,229 | $3,576 | $536 | 15.0% | 5.8% | $1,090 | 0 | $614 | $449 |
| 2026-10-25 | 48 | $9,162 | $3,641 | $393 | 10.8% | 4.3% | $1,380 | 3 | $720 | $301 |

### New Jersey, default scale 0.75, manual tab entry (65% cap, no item costs)

Identical to the first table to the dollar on three Sundays and within $2 on the fourth: at scale 0.75 the win discount only passes 65% for a side with under a 13% chance, which these slates rarely offered.

### New York (scale and cap fixed at 0.5, half-price rule per item)

| Sunday | Players | Bar sales | Covered | Discounts | Effective | Of sales | Worst | Hedge cost | Hedge paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-15 | 48 | $8,360 | $2,969 | $168 | 5.6% | 2.0% | $597 | $275 | $128 |
| 2026-11-08 | 48 | $9,255 | $3,654 | $267 | 7.3% | 2.9% | $601 | $325 | $244 |
| 2026-11-01 | 48 | $9,290 | $3,466 | $285 | 8.2% | 3.1% | $514 | $311 | $247 |
| 2026-10-25 | 48 | $9,162 | $3,641 | $197 | 5.4% | 2.1% | $715 | $372 | $153 |

What the numbers say:

- At the NJ default the bar gives away 8–12% of covered spend and 3–5% of all bar sales. New York runs at roughly two thirds of that. Scale 1.0 adds about a third.
- The worst case is 2.5 to 3.5× the actual discounts. That is the figure a hedge is for.
- Hedging every exposed side at kickoff costs more than the discounts those picks produced on every one of these Sundays: the hedge is insurance against the worst case, not a way to make the promotion free. Hedging only the underdog side (the big payouts) would cost less; the per-side figures are in `fixtures/sim-results.json` after a run.
- The NJ per-item cost floor almost never binds with this menu: pour costs of 20–30% leave room for a 70% discount, and only a scale 1.0 pick on a long shot landing on a high-cost item (Barolo, veal, the reserve pour) hits it. The 65% blended cap is therefore the limit that matters in practice, and the floor is a safety net.

## Screens reviewed

Reviewed on the local dev server with a replay of 2026-11-15 running and the mock POS on: the bartender app and guest page at 375×812 (phone) and the app at 768×1024 (tablet) in the browser pane, plus a scripted pass that loaded the app and guest page in a 375 px frame and measured every button, link, select and input. No horizontal scroll on any screen; every control is at least 44 px in both directions (most are 56 px); no console errors. Two fixes came out of it: the feature-game checkboxes on the manager's Games tab were 28 px (now 44 px; the whole row was already tappable), and the guest page's score box truncated long team names (it now shows the team codes; the full names are in the headline). The TV board was checked at 1920×1080. A search of `src/` for bet, wager, cash out, odds boost, parlay, sportsbook and gamble finds only the FAQ question "Is it gambling?", which is the PRD's own wording; every control says "lock in". The browser pane used for the screenshots could not emulate below 426 px wide, which is why the 375 px check was scripted.

- **Today (phone):** venue name and signed-in staff, big "New pick", games grouped by kickoff window with live line and win chance per side, score, and badges for lock-ins open / line paused / picks closed.
- **New pick, step 3 with the POS on (phone):** the chosen side and its "63% off if they win" on top, then the POS's open checks as one-tap rows (name, check number, item count, subtotal), a "Has a pick" marker on checks already in play, and the manual-entry fallback button.
- **Pick (phone):** entry line, win discount, status ("Lock-in now 9%"), who took it; the gold Lock in button (disabled with "Lock-ins open at the next break" until then); then the POS check panel listing every line with "before the pick" on the ones the pick does not cover, the covered spend, the discount and the dollar amount, and "Ring in a round (mock POS)". After the final the panel gains "Post $X to the check"; once posted the pick shows the amount and the per-line breakdown.
- **Manager, Games (tablet):** demo slate, "Replay a past Sunday" (Sunday and speed pickers), mock POS sample tabs, TV board link, lock-in window, then the schedule by window with feature toggles.
- **Manager, Settings (tablet):** jurisdiction, scale and cap sliders (hidden for New York), "Tabs come from", max covered spend, late-entry cutoff.
- **TV board (1920×1080):** header with the next lock-in and the house-rules QR; one game fills the screen with both sides' kickoff pick value ("off if they win"), the current lock-in value and the new-pick value; two to four games tile; more rotate. Text scales with the number of games so team names no longer truncate.
- **Guest page (phone):** the guest's side, entry line, live score, "if they win" and "lock in right now" values, how lock-in works, and the house rules.

## Mocked, guessed or assumed

- **Toast is a mock.** Objects follow the documented field names, but the behaviour (what a discount post returns, how totals are recalculated, tax handling) is my reading of the docs, and the per-line idempotency reference uses `AppliedDiscount.externalId`, which exists in the schema but whose use I have not confirmed.
- **The menu, prices and costs are invented** for a plausible NJ Italian bar. The NJ sales tax rate in the mock (6.625%) is used only to total the mock check.
- **Guest behaviour in the simulation is guessed:** arrival spread, round timing (every 22–38 min), 28% food attach, stay lengths, 30% play rate, 50/50 favorite/underdog, 35% halftime lock-ins. All of it is a parameter.
- **Kalshi prices stand in for a sportsbook consensus.** The app treats the Kalshi mid as the fair probability and adds a 4.5% margin to show a moneyline; the real product would read moneylines from a licensed feed. Kalshi's own fees are not in the hedge cost.
- **Hedge sizing** uses the kickoff price. A bar hedging after picks come in would pay the live price.
- **Mock POS orders live in Postgres for the app** and in memory for the simulation; both go through the same `MockToastProvider`.
- **Clock seconds within a quarter** in the fixtures are interpolated between plays.

## Open questions

1. **Can a partner add a discount to a check opened on the POS?** Toast's docs say "You can add discounts to a check or menu item selection in an existing order" and only require the check to be `OPEN`, with the `orders.discounts:write` scope; they do not restrict it by order source, but they do not explicitly confirm it works on `source: "In Store"` orders either. Two further constraints matter for this design: the API cannot apply an open *percent* discount (open *amount* is fine, which is what the line-by-line math produces), and a menu item selection can carry only one discount. Both need a sandbox test. Standard API access is read-only; discount writes need the partner or custom integration programme, and so does sandbox access.
2. **Item costs:** Toast's Menus API has no cost field, so per-item costs need another source (CSV upload, inventory integration) before the NJ cost floor can run against a real menu.
3. **Where the lock-in happens with a POS:** today the bartender locks in from the app; with Toast it could be a button on the check instead. Not designed.
4. **Hedge policy:** hedge both sides, underdogs only, or only above an exposure threshold. The simulation can answer this once the owner picks a risk appetite.
5. **Kalshi market coverage:** `KXNFLGAME` covered every Sunday game in these four weeks; whether the same holds for other sports (NBA, NHL) has not been checked.

## How to run

```bash
npm test            # all 62 tests, including the four simulated Sundays
npm run sim         # only the Sunday simulation, prints the table
npm run fixtures:fetch            # refresh fixtures from Kalshi and nflverse (public, no keys)
npm run fixtures:fetch -- --synthetic   # generate fixtures without the network
```

In the app: Manager → Settings → "Tabs come from: Toast open checks (mock POS)", then Manager → Games → "Replay a past Sunday" and "Open sample tabs".
