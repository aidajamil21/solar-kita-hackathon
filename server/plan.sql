-- ============================================================
-- Solar Kita: Solar Builder Plan (monthly payments, repaid over 10 years + up to 3% a year)
-- Run once in the Supabase SQL Editor, after schema.txt / seed.sql. Safe to re-run.
--
-- How it works: every monthly payment is a separate "tranche". Starting the month after it's
-- paid, each tranche returns 1/120 of itself every month for 120 months, plus 3% a year on
-- the part not yet returned. Payments and credits also go into contributions/payouts so
-- portfolio totals, the credit ledger and the AI analyst include them.
-- ============================================================

-- points-ledger activity for plan payments and streak bonuses (must commit before use,
-- which is why this file has no surrounding transaction)
alter type public.activity_type add value if not exists 'plan';

create table if not exists public.builder_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- the solar farm the resident's payments support
  site_id text not null references public.sites(id) on delete restrict,
  monthly_amount numeric(14,2) not null check (monthly_amount between 50 and 10000),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  -- day of the month payments are taken (1-28)
  charge_day smallint not null check (charge_day between 1 and 28),
  next_charge_at timestamptz,
  -- consecutive monthly payments (resets when paused)
  streak integer not null default 0 check (streak >= 0),
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one running (active or paused) plan per resident
create unique index if not exists builder_plans_one_open_idx
  on public.builder_plans(user_id) where status <> 'cancelled';

create table if not exists public.builder_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.builder_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 1, 2, 3... within the plan
  seq integer not null check (seq > 0),
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  unique (plan_id, seq)
);

create index if not exists builder_payments_plan_idx on public.builder_payments(plan_id, seq);

-- link plan money to the existing ledgers (deleted with the payment)
alter table public.contributions
  add column if not exists plan_payment_id uuid references public.builder_payments(id) on delete cascade;
alter table public.payouts
  add column if not exists plan_payment_id uuid references public.builder_payments(id) on delete cascade;
create index if not exists payouts_plan_payment_idx on public.payouts(plan_payment_id);

drop trigger if exists builder_plans_set_updated_at on public.builder_plans;
create trigger builder_plans_set_updated_at
before update on public.builder_plans
for each row execute function public.set_updated_at();

alter table public.builder_plans enable row level security;
alter table public.builder_payments enable row level security;

drop policy if exists builder_plans_select_own on public.builder_plans;
create policy builder_plans_select_own on public.builder_plans
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists builder_payments_select_own on public.builder_payments;
create policy builder_payments_select_own on public.builder_payments
for select to authenticated using (user_id = (select auth.uid()));

-- plans and payments are only written by the trusted backend
revoke insert, update, delete on public.builder_plans, public.builder_payments from anon, authenticated;
grant select on public.builder_plans, public.builder_payments to authenticated;
