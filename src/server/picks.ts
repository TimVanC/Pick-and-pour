import type { Role, Side, StaffView } from "@/lib/app-types";
import {
  coveredSpendCents,
  discountCents,
  lockInDiscount,
  winDiscount,
} from "@/lib/discount";
import { db } from "./db";
import { randomToken } from "./session";
import { UNDO_MS, gamesForVenue, type Venue } from "./state";

/** An error whose message is safe to show to the bartender. */
export class UserError extends Error {}

type Actor = Pick<StaffView, "id"> & { role: Role };
type Row = Record<string, unknown>;

async function audit(
  venueId: string,
  staffId: string | null,
  action: string,
  pickId: string | null,
  before: unknown,
  after: unknown,
): Promise<void> {
  await db()`
    insert into audit_log (venue_id, staff_id, action, pick_id, before, after)
    values (
      ${venueId}, ${staffId}, ${action}, ${pickId},
      ${JSON.stringify(before ?? null)}::jsonb, ${JSON.stringify(after ?? null)}::jsonb
    )
  `;
}

/** Record a manager action that is not about one pick (settings, staff, games). */
export function auditVenue(
  venueId: string,
  staffId: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  return audit(venueId, staffId, action, null, before, after);
}

async function latestSnapshot(gameId: string): Promise<Row | null> {
  const rows = await db()`
    select * from odds_snapshots where game_id = ${gameId}
    order by taken_at desc, id desc limit 1
  `;
  return rows[0] ?? null;
}

async function loadPick(venue: Venue, pickId: string): Promise<Row> {
  const rows = await db()`
    select * from picks where id = ${pickId} and venue_id = ${venue.id}
  `;
  if (!rows[0]) throw new UserError("That pick no longer exists.");
  return rows[0];
}

function summary(row: Row): Row {
  return {
    status: row.status,
    result: row.result,
    d_final: row.d_final,
    covered_cents: row.covered_cents,
    discount_cents: row.discount_cents,
  };
}

export async function createPick(
  venue: Venue,
  actor: Actor,
  input: { gameId: string; side: Side; tabLabel: string; seat: string; subtotalCents: number },
): Promise<string> {
  const tabLabel = input.tabLabel.trim().slice(0, 60);
  const seat = input.seat.trim().slice(0, 12);
  if (!tabLabel) throw new UserError("Add a name for the tab.");
  if (input.side !== "home" && input.side !== "away") throw new UserError("Choose a side.");

  const [game] = await gamesForVenue(venue, { gameId: input.gameId });
  if (!game || !game.featured) throw new UserError("That game is not featured.");
  if (game.status === "final") throw new UserError("That game is over.");
  if (game.suspended) throw new UserError("The line is paused for a play under review. Try again in a moment.");
  if (game.stale) throw new UserError("The line feed is stale. New picks are paused.");
  if (!game.entryOpen) throw new UserError("It is too late in this game for a new pick.");

  const sql = db();
  // One active pick per tab, and never both sides of the same game.
  const existing = await sql`
    select game_id, status from picks
    where venue_id = ${venue.id}
      and lower(tab_label) = lower(${tabLabel}) and lower(seat) = lower(${seat})
      and status <> 'void'
      and created_at > now() - interval '18 hours'
  `;
  if (existing.some((row) => row.game_id === input.gameId)) {
    throw new UserError("This tab already has a pick on this game.");
  }
  if (existing.some((row) => row.status === "open" || row.status === "locked")) {
    throw new UserError("This tab already has an active pick. Settle it first.");
  }

  const snapshot = await latestSnapshot(input.gameId);
  if (!snapshot) throw new UserError("No line for this game yet.");
  const pEntry = Number(snapshot[`${input.side}_p`]);
  const dWin = winDiscount(venue.settings, pEntry);

  const rows = await sql`
    insert into picks
      (venue_id, game_id, side, tab_label, seat, staff_id, entry_snapshot_id,
       p_entry, d_win, subtotal_at_pick_cents, guest_token)
    values (
      ${venue.id}, ${input.gameId}, ${input.side}, ${tabLabel}, ${seat}, ${actor.id},
      ${snapshot.id}, ${pEntry}, ${dWin},
      ${Math.max(0, Math.round(input.subtotalCents))}, ${randomToken()}
    )
    returning id
  `;
  const pickId = String(rows[0].id);
  await audit(venue.id, actor.id, "pick_created", pickId, null, {
    game_id: input.gameId,
    side: input.side,
    tab: tabLabel,
    seat,
    entry_snapshot_id: snapshot.id,
    home_odds: snapshot.home_odds,
    away_odds: snapshot.away_odds,
    p_entry: pEntry,
    d_win: dWin,
  });
  return pickId;
}

export async function lockPick(venue: Venue, actor: Actor, pickId: string): Promise<void> {
  const pick = await loadPick(venue, pickId);
  if (pick.status !== "open") throw new UserError("Only an open pick can be locked in.");

  const [game] = await gamesForVenue(venue, { gameId: String(pick.game_id) });
  if (!game || game.status !== "live") throw new UserError("Lock-ins open once the game is live.");
  if (game.suspended) throw new UserError("The line is paused for a play under review.");
  if (game.stale) throw new UserError("The line feed is stale. Lock-ins are paused.");
  if (!game.lockOpen) throw new UserError("Lock-ins open at the next break.");

  const snapshot = await latestSnapshot(String(pick.game_id));
  if (!snapshot) throw new UserError("No line for this game yet.");
  const pNow = Number(snapshot[`${pick.side}_p`]);
  const dFinal = lockInDiscount(Number(pick.d_win), Number(pick.p_entry), pNow);
  if (dFinal < 0.005) {
    throw new UserError("Nothing to lock in: the line has moved against this pick.");
  }

  const rows = await db()`
    update picks set
      status = 'locked', result = 'locked', d_final = ${dFinal},
      lock_snapshot_id = ${snapshot.id}, locked_at = now()
    where id = ${pickId} and status = 'open'
    returning id
  `;
  if (!rows[0]) throw new UserError("That pick just changed. Check it again.");
  await audit(venue.id, actor.id, "pick_locked", pickId, summary(pick), {
    status: "locked",
    d_final: dFinal,
    lock_snapshot_id: snapshot.id,
    home_odds: snapshot.home_odds,
    away_odds: snapshot.away_odds,
    p_now: pNow,
  });
}

/** Guest leaves before the game ends without a lock-in: the pick ends at full price. */
export async function closePick(venue: Venue, actor: Actor, pickId: string): Promise<void> {
  const pick = await loadPick(venue, pickId);
  if (pick.status !== "open") throw new UserError("Only an open pick can be closed out.");
  const rows = await db()`
    update picks set status = 'settled', result = 'closed', d_final = 0, settled_at = now()
    where id = ${pickId} and status = 'open'
    returning id
  `;
  if (!rows[0]) throw new UserError("That pick just changed. Check it again.");
  await audit(venue.id, actor.id, "pick_closed", pickId, summary(pick), {
    status: "settled",
    result: "closed",
    d_final: 0,
  });
}

/** The bartender has put the discount on the check in the POS. */
export async function applyPick(
  venue: Venue,
  actor: Actor,
  pickId: string,
  subtotalCents: number,
): Promise<void> {
  const pick = await loadPick(venue, pickId);
  if (pick.status !== "locked" && pick.status !== "settled") {
    throw new UserError("This pick is not ready to settle yet.");
  }
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const covered = coveredSpendCents(
    subtotal,
    Number(pick.subtotal_at_pick_cents),
    venue.settings.maxCoveredCents,
  );
  const discount = discountCents(Number(pick.d_final ?? 0), covered);
  const rows = await db()`
    update picks set
      status = 'applied', subtotal_at_settle_cents = ${subtotal},
      covered_cents = ${covered}, discount_cents = ${discount}, applied_at = now()
    where id = ${pickId} and status in ('locked', 'settled')
    returning id
  `;
  if (!rows[0]) throw new UserError("That pick just changed. Check it again.");
  await audit(venue.id, actor.id, "pick_applied", pickId, summary(pick), {
    status: "applied",
    subtotal_cents: subtotal,
    covered_cents: covered,
    discount_cents: discount,
    d_final: pick.d_final,
  });
}

/** Undo a pick or a lock-in within 30 seconds. */
export async function undoPick(venue: Venue, actor: Actor, pickId: string): Promise<void> {
  const pick = await loadPick(venue, pickId);
  const now = Date.now();
  const within = (value: unknown) =>
    value != null && now - new Date(String(value)).getTime() <= UNDO_MS;

  if (pick.status === "open" && within(pick.created_at)) {
    await db()`
      update picks set status = 'void', result = 'undone'
      where id = ${pickId} and status = 'open'
    `;
    await audit(venue.id, actor.id, "pick_undone", pickId, summary(pick), { status: "void" });
    return;
  }
  if (pick.status === "locked" && within(pick.locked_at)) {
    await db()`
      update picks set
        status = 'open', result = null, d_final = null,
        lock_snapshot_id = null, locked_at = null
      where id = ${pickId} and status = 'locked'
    `;
    await audit(venue.id, actor.id, "lock_undone", pickId, summary(pick), { status: "open" });
    return;
  }
  throw new UserError("The 30-second undo has passed. A manager can void this pick.");
}

export async function voidPick(venue: Venue, actor: Actor, pickId: string): Promise<void> {
  if (actor.role !== "manager") throw new UserError("Only a manager can void a pick.");
  const pick = await loadPick(venue, pickId);
  if (pick.status === "void") return;
  await db()`update picks set status = 'void', result = 'void' where id = ${pickId}`;
  await audit(venue.id, actor.id, "pick_voided", pickId, summary(pick), { status: "void" });
}
