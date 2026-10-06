-- Validation en deux étapes, au choix du client :
--   « Par e-mail »          : code à 6 chiffres, 10 minutes, usage unique, stocké HACHÉ (two_factor_email_codes) ;
--   « Avec une application » : TOTP natif de Supabase Auth (auth.mfa_factors), rien à stocker ici.
-- Codes de secours dans les deux cas (two_factor_backup_codes, hachés, usage unique).
-- La méthode choisie est dans two_factor_settings (le client la lit, seul le serveur l'écrit) et recopiée
-- dans auth.users.raw_app_meta_data.two_factor pour que le middleware la connaisse sans requête. Rejouable.

create table if not exists public.two_factor_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  method text not null check (method in ('email', 'totp')),
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.two_factor_settings enable row level security;
drop policy if exists "Lecture de sa propre méthode" on public.two_factor_settings;
create policy "Lecture de sa propre méthode" on public.two_factor_settings
  for select to authenticated using (auth.uid() = user_id);
revoke all on public.two_factor_settings from anon;
revoke insert, update, delete on public.two_factor_settings from authenticated;
grant select on public.two_factor_settings to authenticated;

-- Codes envoyés par e-mail : jamais lisibles hors serveur (même haché, un code ne sort pas de la base).
create table if not exists public.two_factor_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  purpose text not null check (purpose in ('login', 'enable')),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists two_factor_email_codes_user_idx on public.two_factor_email_codes (user_id, created_at desc);
alter table public.two_factor_email_codes enable row level security;
revoke all on public.two_factor_email_codes from anon, authenticated;

create table if not exists public.two_factor_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists two_factor_backup_codes_user_idx on public.two_factor_backup_codes (user_id);
alter table public.two_factor_backup_codes enable row level security;
revoke all on public.two_factor_backup_codes from anon, authenticated;
