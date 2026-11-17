import type {
  GameView,
  PickView,
  Role,
  Side,
  StaffView,
  TeamView,
  VenueSettings,
  VenueView,
} from "@/lib/app-types";
import {
  effectiveLimits,
  jurisdiction,
  lockInDiscount,
  maxCap,
  probabilityToLine,
} from "@/lib/discount";
import type { LineDiscount } from "@/lib/line-discount";
import { db, iso } from "./db";

/** How long a live game can go without fresh odds before picks and lock-ins stop. */
const STALE_MS = 2 * 60 * 1000;
/** How long the creating staff member can undo a pick or a lock-in. */
export const UNDO_MS = 30 * 1000;

export type Venue = {
  id: string;
  name: string;
  jurisdictionCode: string;
  timezone: string;
  tvToken: string;
  passcodeHash: string;
  settings: VenueSettings;
  /** True when a POS with item costs is connected (per-item limits apply). */
  costFloors: boolean;
};

type Row = Record<string, unknown>;

function venueFromRow(row: Row): Venue {
  const profile = jurisdiction(String(row.jurisdiction_code));
  const raw = (row.settings ?? {}) as Partial<VenueSettings>;
  const posProvider = raw.posProvider === "mock-toast" ? "mock-toast" : "manual";
  // A connected POS carries item costs, which turns the per-item limits on.
  const costFloors = posProvider !== "manual";
  const limits = effectiveLimits(profile, { ...raw, costFloors });
  return {
    id: String(row.id),
    name: String(row.name),
    jurisdictionCode: profile.code,
    timezone: String(row.timezone),
    tvToken: String(row.tv_token),
    passcodeHash: String(row.passcode_hash),
    settings: {
      scale: limits.scale,
      cap: limits.cap,
      maxCoveredCents: raw.maxCoveredCents ?? 10000,
      lateCutoffPeriod: raw.lateCutoffPeriod ?? 3,
      lockWindowUntil: raw.lockWindowUntil ?? null,
      favoriteTeams: raw.favoriteTeams ?? [],
      posProvider,
    },
    costFloors,
  };
}

export async function venueById(id: string): Promise<Venue | null> {
  const rows = await db()`select * from venues where id = ${id}`;
  return rows[0] ? venueFromRow(rows[0]) : null;
}

export async function venueByTvToken(token: string): Promise<Venue | null> {
  const rows = await db()`select * from venues where tv_token = ${token}`;
  return rows[0] ? venueFromRow(rows[0]) : null;
}

export async function allVenues(): Promise<Venue[]> {
  const rows = await db()`select * from venues order by created_at limit 50`;
  return rows.map(venueFromRow);
}

export function venueView(venue: Venue): VenueView {
  const profile = jurisdiction(venue.jurisdictionCode);
  return {
    name: venue.name,
    jurisdictionCode: profile.code,
    jurisdictionName: profile.name,
    rulesText: profile.rulesText,
    settings: venue.settings,
    limits: { scale: venue.settings.scale, cap: venue.settings.cap },
    costFloors: venue.costFloors,
    maxCap: maxCap(profile, venue.costFloors),
  };
}

export async function staffForVenue(venueId: string): Promise<(StaffView & { pinHash: string })[]> {
  const rows = await db()`
    select id, name, role, pin_hash from staff
    where venue_id = ${venueId} and active
    order by created_at
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    role: row.role as Role,
    pinHash: String(row.pin_hash),
  }));
}

function team(row: Row, side: Side): TeamView {
  const p = row[`${side}_p`];
  const kickoff = row[`kickoff_${side}_p`];
  return {
    name: String(row[side]),
    abbr: String(row[`${side}_abbr`]),
    score: Number(row[`${side}_score`]),
    line: p == null ? null : probabilityToLine(Number(p)),
    p: p == null ? null : Number(p),
    kickoffP: kickoff == null ? null : Number(kickoff),
  };
}

function gameFromRow(row: Row, venue: Venue, now: Date): GameView {
  const status = row.status as GameView["status"];
  const takenAt = row.taken_at ? new Date(String(iso(row.taken_at))) : null;
  const suspended = Boolean(row.suspended);
  const stale =
    status === "live" && (!takenAt || now.getTime() - takenAt.getTime() > STALE_MS);
  const playable = (status === "scheduled" || status === "live") && takenAt !== null;
  const period = Number(row.period);
  const isBreak = Boolean(row.is_break);
  const windowOpen =
    venue.settings.lockWindowUntil !== null &&
    new Date(venue.settings.lockWindowUntil).getTime() > now.getTime();

  return {
    id: String(row.id),
    windowLabel: String(row.window_label),
    startTime: String(iso(row.start_time)),
    status,
    period,
    clockSeconds: Number(row.clock_seconds),
    isBreak,
    breakLabel: (row.break_label as string | null) ?? null,
    winner: (row.winner as GameView["winner"]) ?? null,
    home: team(row, "home"),
    away: team(row, "away"),
    suspended,
    stale,
    featured: Boolean(row.featured),
    entryOpen:
      Boolean(row.featured) &&
      playable &&
      !suspended &&
      !stale &&
      period <= venue.settings.lateCutoffPeriod,
    lockOpen: status === "live" && !suspended && !stale && (isBreak || windowOpen),
  };
}

/** The venue's schedule: its featured games plus today's other games it could feature. */
export async function gamesForVenue(
  venue: Venue,
  options: { featuredOnly?: boolean; gameId?: string } = {},
): Promise<GameView[]> {
  const rows = await db()`
    select g.*,
      (f.game_id is not null) as featured,
      latest.home_p, latest.away_p, latest.suspended, latest.taken_at,
      first.home_p as kickoff_home_p, first.away_p as kickoff_away_p
    from games g
    left join featured_games f on f.game_id = g.id and f.venue_id = ${venue.id}
    left join lateral (
      select * from odds_snapshots s where s.game_id = g.id
      order by s.taken_at desc, s.id desc limit 1
    ) latest on true
    left join lateral (
      select * from odds_snapshots s where s.game_id = g.id
      order by s.taken_at asc, s.id asc limit 1
    ) first on true
    where (${options.gameId ?? null}::uuid is null or g.id = ${options.gameId ?? null}::uuid)
      and (
        ${options.gameId ?? null}::uuid is not null
        or (
          g.start_time > now() - interval '8 hours'
          -- Demo and replay games belong to the venue that started them.
          and (g.provider not in ('sim', 'kalshi-replay') or g.provider_game_id like ${`${venue.id}:%`})
          and (${options.featuredOnly ?? false}::boolean = false or f.game_id is not null)
          -- Finished games from an earlier slate only stay while they still have picks.
          and (
            f.game_id is not null
            or g.status in ('scheduled', 'live')
            or exists (
              select 1 from picks p
              where p.game_id = g.id and p.venue_id = ${venue.id}
                and p.created_at > now() - interval '24 hours'
            )
          )
        )
      )
    order by g.start_time, g.home
  `;
  const now = new Date();
  return rows.map((row) => gameFromRow(row, venue, now));
}

export function pickFromRow(row: Row, game: GameView | undefined, now: Date): PickView {
  const side = row.side as Side;
  const status = row.status as PickView["status"];
  const pEntry = Number(row.p_entry);
  const dWin = Number(row.d_win);
  const pNow = game?.[side].p ?? null;
  const createdAt = String(iso(row.created_at));
  const lockedAt = iso(row.locked_at);

  // Undo is open for 30 seconds after the last reversible step.
  const undoFrom = status === "open" ? createdAt : status === "locked" ? lockedAt : null;
  const undoUntil =
    undoFrom && new Date(undoFrom).getTime() + UNDO_MS > now.getTime()
      ? new Date(new Date(undoFrom).getTime() + UNDO_MS).toISOString()
      : null;

  return {
    id: String(row.id),
    gameId: String(row.game_id),
    side,
    tabLabel: String(row.tab_label),
    seat: String(row.seat ?? ""),
    staffName: (row.staff_name as string | null) ?? null,
    pEntry,
    entryLine: probabilityToLine(pEntry),
    dWin,
    status,
    result: (row.result as string | null) ?? null,
    dFinal: row.d_final == null ? null : Number(row.d_final),
    lockValue:
      status === "open" && pNow !== null ? lockInDiscount(dWin, pEntry, pNow) : null,
    subtotalAtPickCents: Number(row.subtotal_at_pick_cents),
    subtotalAtSettleCents:
      row.subtotal_at_settle_cents == null ? null : Number(row.subtotal_at_settle_cents),
    coveredCents: row.covered_cents == null ? null : Number(row.covered_cents),
    discountCents: row.discount_cents == null ? null : Number(row.discount_cents),
    guestToken: String(row.guest_token),
    createdAt,
    lockedAt,
    settledAt: iso(row.settled_at),
    appliedAt: iso(row.applied_at),
    undoUntil,
    posOrderId: (row.pos_order_id as string | null) ?? null,
    posCheckId: (row.pos_check_id as string | null) ?? null,
    discountLines: (row.discount_lines as LineDiscount[] | null) ?? null,
  };
}

/** The venue's picks from the last 24 hours, newest first. */
export async function picksForVenue(venue: Venue, games: GameView[]): Promise<PickView[]> {
  const rows = await db()`
    select p.*, s.name as staff_name
    from picks p
    left join staff s on s.id = p.staff_id
    where p.venue_id = ${venue.id} and p.created_at > now() - interval '24 hours'
    order by p.created_at desc
  `;
  const byId = new Map(games.map((game) => [game.id, game]));
  const now = new Date();
  return rows.map((row) => pickFromRow(row, byId.get(String(row.game_id)), now));
}
