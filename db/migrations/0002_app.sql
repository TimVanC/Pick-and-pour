-- The Pick & Pour app: venues, staff, games, odds snapshots, picks and the audit log.
-- Apply after 0001_leads.sql. All statements are safe to run twice.

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jurisdiction_code text not null default 'NJ',
  timezone text not null default 'America/New_York',
  -- Secret in the TV board link (/tv/<tv_token>).
  tv_token text not null unique,
  -- Hash of the passcode that signs a device in to this venue.
  passcode_hash text not null,
  -- scale, cap, maxCoveredCents, lateCutoffPeriod, lockWindowUntil, favoriteTeams
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  role text not null check (role in ('manager', 'bartender')),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_venue_idx on public.staff (venue_id);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  -- Which OddsProvider owns this game ('sim' for the built-in demo feed).
  provider text not null,
  provider_game_id text not null,
  sport text not null default 'NFL',
  home text not null,
  away text not null,
  home_abbr text not null,
  away_abbr text not null,
  start_time timestamptz not null,
  window_label text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
  period int not null default 0,
  clock_seconds int not null default 0,
  is_break boolean not null default false,
  break_label text,
  home_score int not null default 0,
  away_score int not null default 0,
  -- 'home', 'away' or 'tie' once final.
  winner text check (winner in ('home', 'away', 'tie')),
  -- Private state of the provider (the simulation's internals).
  provider_state jsonb,
  -- Used to make sure only one request advances a game at a time.
  last_tick_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_game_id)
);
create index if not exists games_start_time_idx on public.games (start_time);

create table if not exists public.featured_games (
  venue_id uuid not null references public.venues (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  window_label text not null,
  primary key (venue_id, game_id)
);

create table if not exists public.odds_snapshots (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  taken_at timestamptz not null default now(),
  home_odds int not null,
  away_odds int not null,
  -- Vig-free win probabilities.
  home_p double precision not null,
  away_p double precision not null,
  books_raw jsonb,
  suspended boolean not null default false
);
create index if not exists odds_snapshots_game_taken_idx
  on public.odds_snapshots (game_id, taken_at desc);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  game_id uuid not null references public.games (id),
  side text not null check (side in ('home', 'away')),
  tab_label text not null,
  seat text not null default '',
  staff_id uuid references public.staff (id),
  entry_snapshot_id bigint references public.odds_snapshots (id),
  p_entry double precision not null,
  d_win double precision not null,
  status text not null default 'open'
    check (status in ('open', 'locked', 'settled', 'applied', 'void')),
  -- Why the pick ended: won, lost, tie, locked, closed (left early), undone, void.
  result text,
  lock_snapshot_id bigint references public.odds_snapshots (id),
  d_final double precision,
  subtotal_at_pick_cents int not null default 0,
  subtotal_at_settle_cents int,
  covered_cents int,
  discount_cents int,
  -- Secret in the guest link (/p/<guest_token>).
  guest_token text not null unique,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  settled_at timestamptz,
  applied_at timestamptz
);
create index if not exists picks_venue_created_idx on public.picks (venue_id, created_at desc);
create index if not exists picks_game_status_idx on public.picks (game_id, status);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  venue_id uuid not null references public.venues (id) on delete cascade,
  -- Null when the system did it (for example settling picks at the final whistle).
  staff_id uuid references public.staff (id),
  action text not null,
  pick_id uuid references public.picks (id),
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_log_venue_at_idx on public.audit_log (venue_id, at desc);
