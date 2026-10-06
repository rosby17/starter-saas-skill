-- Journal des e-mails envoyés par le site (Administration › E-mails) : destinataire, sujet, modèle,
-- résultat et, en cas d'échec, la réponse du fournisseur. Jamais le contenu (un e-mail peut porter un code).
-- Serveur uniquement. Rejouable.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_email text not null,
  subject text not null,
  template text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_status integer,
  provider_response text,
  message_id text,
  is_example boolean not null default false
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
