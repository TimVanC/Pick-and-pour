import type { ReportView, Role, VenueSettings } from "@/lib/app-types";
import { effectiveLimits, jurisdiction, JURISDICTIONS } from "@/lib/discount";
import { db } from "./db";
import { createDemoSlate } from "./odds/refresh";
import { UserError, auditVenue } from "./picks";
import { hashSecret, verifySecret } from "./session";
import { staffForVenue, type Venue } from "./state";

/** Most games a window can feature, so the TV board stays readable. */
const MAX_FEATURED_PER_WINDOW = 4;

export async function updateSettings(
  venue: Venue,
  staffId: string,
  input: Partial<VenueSettings> & { jurisdictionCode?: string },
): Promise<void> {
  const code =
    input.jurisdictionCode && input.jurisdictionCode in JURISDICTIONS
      ? input.jurisdictionCode
      : venue.jurisdictionCode;
  const profile = jurisdiction(code);
  // Whatever is asked for, the jurisdiction's limits win.
  const limits = effectiveLimits(profile, {
    scale: input.scale ?? venue.settings.scale,
    cap: input.cap ?? venue.settings.cap,
  });
  const settings: VenueSettings = {
    ...venue.settings,
    ...limits,
    maxCoveredCents: Math.min(
      100000,
      Math.max(1000, Math.round(input.maxCoveredCents ?? venue.settings.maxCoveredCents)),
    ),
    lateCutoffPeriod: Math.min(
      4,
      Math.max(0, Math.round(input.lateCutoffPeriod ?? venue.settings.lateCutoffPeriod)),
    ),
    favoriteTeams: (input.favoriteTeams ?? venue.settings.favoriteTeams).slice(0, 8),
  };
  await db()`
    update venues set jurisdiction_code = ${code}, settings = ${JSON.stringify(settings)}::jsonb
    where id = ${venue.id}
  `;
  await auditVenue(
    venue.id,
    staffId,
    "settings_changed",
    { jurisdiction: venue.jurisdictionCode, ...venue.settings },
    { jurisdiction: code, ...settings },
  );
}

/** Let guests lock in for the next few minutes even though the game is not at a break. */
export async function openLockWindow(
  venue: Venue,
  staffId: string,
  minutes: number,
): Promise<void> {
  const until = minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;
  const settings = { ...venue.settings, lockWindowUntil: until };
  await db()`
    update venues set settings = ${JSON.stringify(settings)}::jsonb where id = ${venue.id}
  `;
  await auditVenue(venue.id, staffId, "lock_window", null, { until });
}

export async function setFeatured(
  venue: Venue,
  staffId: string,
  gameId: string,
  featured: boolean,
): Promise<void> {
  const sql = db();
  if (!featured) {
    const active = await sql`
      select 1 from picks
      where venue_id = ${venue.id} and game_id = ${gameId} and status in ('open', 'locked')
      limit 1
    `;
    if (active[0]) throw new UserError("This game has active picks. Settle or void them first.");
    await sql`delete from featured_games where venue_id = ${venue.id} and game_id = ${gameId}`;
  } else {
    const games = await sql`select window_label from games where id = ${gameId}`;
    if (!games[0]) throw new UserError("That game no longer exists.");
    const windowLabel = String(games[0].window_label);
    const count = await sql`
      select count(*)::int as count from featured_games
      where venue_id = ${venue.id} and window_label = ${windowLabel}
    `;
    if (Number(count[0].count) >= MAX_FEATURED_PER_WINDOW) {
      throw new UserError(
        `A window can feature ${MAX_FEATURED_PER_WINDOW} games. Use "Feature all" to go past that.`,
      );
    }
    await sql`
      insert into featured_games (venue_id, game_id, window_label)
      values (${venue.id}, ${gameId}, ${windowLabel})
      on conflict do nothing
    `;
  }
  await auditVenue(venue.id, staffId, "game_featured", null, { game_id: gameId, featured });
}

/** The "feature every game in this window" switch. */
export async function featureWindow(
  venue: Venue,
  staffId: string,
  windowLabel: string,
): Promise<void> {
  await db()`
    insert into featured_games (venue_id, game_id, window_label)
    select ${venue.id}, g.id, g.window_label from games g
    where g.window_label = ${windowLabel}
      and g.start_time > now() - interval '8 hours'
      and g.status in ('scheduled', 'live')
      and (g.provider <> 'sim' or g.provider_game_id like ${`${venue.id}:%`})
    on conflict do nothing
  `;
  await auditVenue(venue.id, staffId, "window_featured", null, { window: windowLabel });
}

export async function newDemoSlate(venue: Venue, staffId: string): Promise<void> {
  const active = await db()`
    select 1 from picks where venue_id = ${venue.id} and status in ('open', 'locked') limit 1
  `;
  if (active[0]) {
    throw new UserError("There are active picks. Settle or void them before starting a new slate.");
  }
  await createDemoSlate(venue.id, venue.settings.favoriteTeams);
  await auditVenue(venue.id, staffId, "demo_slate_created", null, null);
}

function validPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function addStaff(
  venue: Venue,
  staffId: string,
  input: { name: string; role: Role; pin: string },
): Promise<void> {
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new UserError("Add a name.");
  if (!validPin(input.pin)) throw new UserError("A PIN is 4 digits.");
  const role: Role = input.role === "manager" ? "manager" : "bartender";
  // PINs identify the person, so two people cannot share one.
  const existing = await staffForVenue(venue.id);
  if (existing.some((member) => verifySecret(input.pin, member.pinHash))) {
    throw new UserError("That PIN is already in use. Choose another.");
  }
  await db()`
    insert into staff (venue_id, name, role, pin_hash)
    values (${venue.id}, ${name}, ${role}, ${hashSecret(input.pin)})
  `;
  await auditVenue(venue.id, staffId, "staff_added", null, { name, role });
}

export async function removeStaff(
  venue: Venue,
  staffId: string,
  targetId: string,
): Promise<void> {
  if (targetId === staffId) throw new UserError("You can't remove yourself.");
  const rows = await db()`
    update staff set active = false
    where id = ${targetId} and venue_id = ${venue.id} and active
    returning name, role
  `;
  if (!rows[0]) throw new UserError("That person is already removed.");
  await auditVenue(venue.id, staffId, "staff_removed", rows[0], null);
}

/** Totals for one game day, in the venue's own timezone. */
export async function reportForDay(venue: Venue, date: string): Promise<ReportView> {
  const rows = await db()`
    select
      count(*) filter (where status <> 'void')::int as picks,
      count(distinct lower(tab_label) || '|' || lower(seat)) filter (where status <> 'void')::int as players,
      coalesce(sum(covered_cents) filter (where status = 'applied'), 0)::int as covered_cents,
      coalesce(sum(discount_cents) filter (where status = 'applied'), 0)::int as discount_cents,
      count(*) filter (where result = 'won')::int as won,
      count(*) filter (where result in ('lost', 'tie', 'closed'))::int as lost,
      count(*) filter (where result = 'locked')::int as locked,
      count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status = 'void')::int as voided,
      avg(extract(epoch from (applied_at - created_at)) / 60)
        filter (where status = 'applied') as minutes_to_settle
    from picks
    where venue_id = ${venue.id}
      and (created_at at time zone ${venue.timezone})::date = ${date}::date
  `;
  const row = rows[0];
  const covered = Number(row.covered_cents);
  return {
    date,
    picks: Number(row.picks),
    players: Number(row.players),
    coveredCents: covered,
    discountCents: Number(row.discount_cents),
    averageDiscount: covered > 0 ? Number(row.discount_cents) / covered : null,
    won: Number(row.won),
    lost: Number(row.lost),
    locked: Number(row.locked),
    open: Number(row.open),
    voided: Number(row.voided),
    minutesToSettle:
      row.minutes_to_settle == null ? null : Math.round(Number(row.minutes_to_settle)),
  };
}

/** One row per pick for the CSV export. */
export async function reportRows(venue: Venue, date: string): Promise<string> {
  const rows = await db()`
    select p.created_at, p.tab_label, p.seat, g.away || ' at ' || g.home as game,
      case when p.side = 'home' then g.home else g.away end as side,
      p.p_entry, p.d_win, p.status, p.result, p.d_final,
      p.subtotal_at_pick_cents, p.subtotal_at_settle_cents,
      p.covered_cents, p.discount_cents, p.applied_at, s.name as staff
    from picks p
    join games g on g.id = p.game_id
    left join staff s on s.id = p.staff_id
    where p.venue_id = ${venue.id}
      and (p.created_at at time zone ${venue.timezone})::date = ${date}::date
    order by p.created_at
  `;
  const header = [
    "created_at", "tab", "seat", "game", "side", "p_entry", "d_win", "status", "result",
    "d_final", "subtotal_at_pick", "subtotal_at_settle", "covered", "discount",
    "applied_at", "staff",
  ];
  const dollars = (cents: unknown) => (cents == null ? "" : (Number(cents) / 100).toFixed(2));
  const cell = (value: unknown) => {
    const text =
      value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
    // Quote everything, and defuse values a spreadsheet would run as a formula.
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const lines = rows.map((row) =>
    [
      row.created_at, row.tab_label, row.seat, row.game, row.side,
      Number(row.p_entry).toFixed(4), Number(row.d_win).toFixed(4), row.status, row.result,
      row.d_final == null ? "" : Number(row.d_final).toFixed(4),
      dollars(row.subtotal_at_pick_cents), dollars(row.subtotal_at_settle_cents),
      dollars(row.covered_cents), dollars(row.discount_cents), row.applied_at, row.staff,
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

/** Today's date (YYYY-MM-DD) in the venue's timezone. */
export function todayFor(venue: Venue): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: venue.timezone }).format(new Date());
}
