-- ============================================================
-- Solar Kita: Go Green (walk & cycle to earn points)
-- Run once in the Supabase SQL Editor, after schema.txt / seed.sql.
-- Safe to re-run.
-- ============================================================

-- New activity kinds for the points ledger. (ADD VALUE must commit before
-- it can be used, which is why this file has no surrounding transaction.)
alter type public.activity_type add value if not exists 'walk';
alter type public.activity_type add value if not exists 'cycle';

create table if not exists public.green_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  township_id text references public.townships(id) on delete set null,
  mode text not null check (mode in ('walk', 'cycle')),
  -- 'gps' = recorded on the phone, 'demo' = the app's demo route
  source text not null default 'gps' check (source in ('gps', 'demo')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- all figures below are computed by the server from the GPS path
  distance_km numeric(8,3) not null check (distance_km >= 0),
  duration_min numeric(8,2) not null check (duration_min > 0),
  inside_pct numeric(5,2) not null check (inside_pct between 0 and 100),
  points integer not null default 0 check (points >= 0),
  co2_saved_kg numeric(10,3) not null default 0,
  petrol_saved_l numeric(10,3) not null default 0,
  -- simplified route [[lat, lon], ...] for drawing the trip
  path jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint trip_time_order check (ended_at > started_at)
);

create index if not exists green_trips_user_date_idx on public.green_trips(user_id, started_at desc);

alter table public.green_trips enable row level security;

drop policy if exists green_trips_select_own on public.green_trips;
create policy green_trips_select_own on public.green_trips
for select to authenticated using (user_id = (select auth.uid()));

-- trips (and their points) are only written by the trusted backend
revoke insert, update, delete on public.green_trips from anon, authenticated;
grant select on public.green_trips to authenticated;
