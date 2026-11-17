-- Version 2: picks attached to a POS check, and storage for the mock POS.
-- Apply after 0002_app.sql. All statements are safe to run twice.

-- The POS check a pick is attached to (null for manually labelled tabs).
alter table public.picks add column if not exists pos_order_id text;
alter table public.picks add column if not exists pos_check_id text;
-- The line-by-line discount that was posted to the check, for audits.
alter table public.picks add column if not exists discount_lines jsonb;

create index if not exists picks_pos_check_idx on public.picks (venue_id, pos_check_id);

-- Orders of the mock POS (Toast-shaped JSON). Only the mock provider uses this.
create table if not exists public.mock_pos_orders (
  restaurant_guid text not null,
  order_guid text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (restaurant_guid, order_guid)
);
