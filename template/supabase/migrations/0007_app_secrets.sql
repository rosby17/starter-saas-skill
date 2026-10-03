-- ---------------------------------------------------------------------------
-- app_secrets : clés saisies depuis /admin/keys (passerelles, Brevo, CRON_SECRET).
-- Valeurs CHIFFRÉES côté serveur (AES-256-GCM, voir src/lib/secrets/store.ts).
-- RLS activée SANS politique : seul le client service (serveur) lit et écrit ;
-- même un administrateur connecté ne peut pas lire la table depuis le navigateur.
-- ---------------------------------------------------------------------------
create table if not exists public.app_secrets (
  name text primary key,
  ciphertext text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
