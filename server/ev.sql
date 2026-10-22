-- ============================================================
-- Solar Kita: EV charging bookings
-- Run once in the Supabase SQL Editor, after schema.txt / seed.sql. Safe to re-run.
--
-- Residents book a bay at a township EV station for 1-4 hours. Electricity is a fixed price
-- per kWh all day; charging during the solar peak (11am-3pm, when the station's solar canopy
-- produces the most) earns more points. The bill is settled after charging ends.
-- ============================================================

-- points-ledger activity for paid charging sessions (must commit before use,
-- which is why this file has no surrounding transaction)
alter type public.activity_type add value if not exists 'charge';
-- notifications about bookings and charging sessions
alter type public.alert_type add value if not exists 'ev_charging';

create table if not exists public.ev_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- an EV station (a site of kind 'ev'); bays are its units, 0-based
  site_id text not null references public.sites(id) on delete restrict,
  bay smallint not null check (bay >= 0),
  starts_at timestamptz not null,
  hours smallint not null check (hours between 1 and 4),
  -- booked -> charging -> awaiting_payment -> paid, or cancelled / missed
  status text not null default 'booked'
    check (status in ('booked', 'charging', 'awaiting_payment', 'paid', 'cancelled', 'missed')),
  energy_kwh numeric(8,2) check (energy_kwh >= 0),
  -- the part of energy_kwh delivered during the solar peak
  peak_kwh numeric(8,2) check (peak_kwh >= 0),
  amount numeric(10,2) check (amount >= 0),
  points integer check (points >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ev_bookings_user_idx on public.ev_bookings(user_id, starts_at desc);

-- one row per booked hour; the unique key stops two bookings sharing a bay in the same hour
create table if not exists public.ev_booking_slots (
  booking_id uuid not null references public.ev_bookings(id) on delete cascade,
  site_id text not null references public.sites(id) on delete cascade,
  bay smallint not null,
  slot_start timestamptz not null,
  primary key (booking_id, slot_start),
  unique (site_id, bay, slot_start)
);

create index if not exists ev_booking_slots_site_idx on public.ev_booking_slots(site_id, slot_start);

drop trigger if exists ev_bookings_set_updated_at on public.ev_bookings;
create trigger ev_bookings_set_updated_at
before update on public.ev_bookings
for each row execute function public.set_updated_at();

alter table public.ev_bookings enable row level security;
alter table public.ev_booking_slots enable row level security;

drop policy if exists ev_bookings_select_own on public.ev_bookings;
create policy ev_bookings_select_own on public.ev_bookings
for select to authenticated using (user_id = (select auth.uid()));

-- bookings and bay holds are only written by the trusted backend
revoke insert, update, delete on public.ev_bookings, public.ev_booking_slots from anon, authenticated;
grant select on public.ev_bookings to authenticated;
