-- Verrous des tâches planifiées (voir src/lib/cron-lock.ts). Rejouable.
create table if not exists public.cron_locks (
  name text primary key,
  locked_at timestamptz not null default now()
);
-- Accessible uniquement avec la clé service : RLS activée sans aucune politique.
alter table public.cron_locks enable row level security;
