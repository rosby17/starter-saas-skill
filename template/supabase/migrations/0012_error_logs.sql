-- Journal des erreurs : chaque échec vu par un client (source 'web'), chaque plantage serveur ('server')
-- et chaque échec d'API ('api') reçoit une référence courte (ex. ERR-7K3QXM) que le client donne au support.
-- La gravité n'est PAS stockée : elle se déduit à la lecture (src/lib/monitoring/explain-error.ts).
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  created_at timestamptz not null default now(),
  user_id uuid,
  source text not null check (source in ('web', 'server', 'api')),
  page text,
  action text not null,
  http_status integer,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
);

create index if not exists error_logs_created_idx on public.error_logs (created_at desc);
create index if not exists error_logs_open_idx on public.error_logs (created_at desc) where resolved_at is null;
create index if not exists error_logs_provider_idx on public.error_logs (created_at desc) where (details->>'error_code') = 'provider_unavailable';

-- Réservée au serveur (service_role ignore la RLS) : aucune policy.
alter table public.error_logs enable row level security;
revoke all on public.error_logs from anon, authenticated;
