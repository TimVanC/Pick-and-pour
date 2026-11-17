-- Demo requests from the marketing site (/demo).
-- Rows are written only by the server with the service-role key.
-- Row Level Security is on with no policies, so the public (anon) key can't read or write.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  bar_name text not null,
  city_state text not null,
  role text not null,
  phone text,
  email text not null,
  sports text[] not null default '{}',
  tv_count text,
  notes text,
  -- Salted hash of the sender's IP, used only for rate limiting.
  ip_hash text
);

alter table public.leads enable row level security;

create index if not exists leads_ip_hash_created_at_idx
  on public.leads (ip_hash, created_at desc);
