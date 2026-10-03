-- Tables lues par les pages Aide (client) et Support / Feedback (admin).
-- Rejouable : on peut l'appliquer plusieurs fois sans erreur.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
alter table public.support_tickets enable row level security;

drop policy if exists "Users read own tickets" on public.support_tickets;
create policy "Users read own tickets" on public.support_tickets for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists "Users create own tickets" on public.support_tickets;
create policy "Users create own tickets" on public.support_tickets for insert
  with check (auth.uid() = user_id);
drop policy if exists "Admins update tickets" on public.support_tickets;
create policy "Admins update tickets" on public.support_tickets for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedbacks_user_id_idx on public.feedbacks (user_id);
alter table public.feedbacks enable row level security;

drop policy if exists "Users create feedback" on public.feedbacks;
create policy "Users create feedback" on public.feedbacks for insert
  with check (auth.uid() = user_id);
drop policy if exists "Admins read feedback" on public.feedbacks;
create policy "Admins read feedback" on public.feedbacks for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
