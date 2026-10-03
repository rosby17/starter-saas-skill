-- Minimal schema matching what the copied billing/admin code queries.
-- Adjust freely — this is a starting point, not a complete data model.

-- ---------------------------------------------------------------------------
-- profiles: extends auth.users with app-specific fields
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, new.raw_user_meta_data->>'first_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- orders: one row per checkout attempt (pending -> success/failed/flagged_*)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text,
  credits integer not null default 0,
  amount_local numeric not null default 0,
  currency text not null default 'XOF',
  payment_method text,
  payment_ref text,
  status text not null default 'pending', -- pending | success | failed | flagged_underpaid | flagged_reversal
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Inserts/updates on orders go through the service-role key from API routes,
-- so no INSERT/UPDATE policy is granted to regular users here.

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_created_at_idx on public.orders(status, created_at);

-- ---------------------------------------------------------------------------
-- credits: append-only ledger. Balance = sum(amount) for a user.
-- ---------------------------------------------------------------------------
create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null, -- positive = credit, negative = debit
  source text not null,    -- e.g. 'purchase', 'signup_bonus', 'usage'
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.credits enable row level security;

drop policy if exists "Users can view their own credit ledger" on public.credits;
create policy "Users can view their own credit ledger"
  on public.credits for select
  using (auth.uid() = user_id);

create index if not exists credits_user_id_idx on public.credits(user_id);

-- ---------------------------------------------------------------------------
-- system_settings: single-row key/value store, used for the maintenance gate
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- Public read access to the maintenance flag only — middleware runs with the
-- anon key, so it must be able to read this without authentication.
drop policy if exists "Anyone can read the maintenance flag" on public.system_settings;
create policy "Anyone can read the maintenance flag"
  on public.system_settings for select
  using (key = 'maintenance');

-- ---------------------------------------------------------------------------
-- announcements: used by the admin dashboard
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "Anyone can read published announcements" on public.announcements;
create policy "Anyone can read published announcements"
  on public.announcements for select
  using (published = true);
