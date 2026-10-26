-- PILOTAGE ET FINANCES (Administration › Revenus) : ce que l'on gagne VRAIMENT après avoir vendu.
--  · finance_charges     : charges fixes (abonnements mensuels ou annuels, part imputée) et dépenses ponctuelles ;
--  · provider_rates      : tarifs DATÉS des fournisseurs payés à l'usage (montant, devise, pour combien d'unités) ;
--  · payment_fee_rates   : frais DATÉS de chaque moyen de paiement (% de chaque vente) ;
--  · provider_usage      : usage réel noté à chaque appel d'un fournisseur (le coût en est CALCULÉ, jamais saisi) ;
--  · money_adjustments   : entrées d'argent hors passerelle et retraits, avec leur motif (vente manuelle, collaboration,
--                          don, remboursement…) et leur valeur au prix du site (manque à gagner).
-- Un changement de tarif = une NOUVELLE ligne datée : l'historique de la marge n'est jamais réécrit.
-- Lecture réservée aux administrateurs ; écriture par le serveur seulement (clé service, derrière requireAdmin). Rejouable.

-- ---------------------------------------------------------------------------
-- Charges fixes et ponctuelles
-- ---------------------------------------------------------------------------
create table if not exists public.finance_charges (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 120),
  family text not null check (family in ('fixe', 'ponctuelle')),
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'XAF' check (currency in ('XAF', 'EUR', 'USD')),
  period text not null default 'monthly' check (period in ('monthly', 'yearly', 'once')),
  share_pct numeric not null default 100 check (share_pct between 0 and 100),
  free boolean not null default false,
  starts_on date,            -- fixe : premier jour facturé (vide = depuis toujours) ; ponctuelle : date de la dépense
  ends_on date,              -- fixe : dernier jour facturé (vide = toujours en cours)
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_charges_once_check check (
    (family = 'ponctuelle' and period = 'once' and starts_on is not null)
    or (family = 'fixe' and period in ('monthly', 'yearly'))
  ),
  constraint finance_charges_range_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists finance_charges_created_by_idx on public.finance_charges (created_by);
create index if not exists finance_charges_starts_on_idx on public.finance_charges (starts_on);

-- ---------------------------------------------------------------------------
-- Tarifs datés des fournisseurs (« 5 USD pour 1 000 000 unités, à partir du 01/10 »)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9_.-]{1,40}$'),
  service text not null default '' check (char_length(service) <= 60),   -- vide = tous les services du fournisseur
  label text check (label is null or char_length(label) <= 80),
  amount numeric not null check (amount >= 0),
  currency text not null default 'USD' check (currency in ('XAF', 'EUR', 'USD')),
  per_units numeric not null default 1000000 check (per_units > 0),
  unit text not null default 'unités' check (char_length(unit) between 1 and 30),
  valid_from date not null,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider, service, valid_from)
);
create index if not exists provider_rates_created_by_idx on public.provider_rates (created_by);

-- ---------------------------------------------------------------------------
-- Frais datés des moyens de paiement (« * » = taux par défaut)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_fee_rates (
  id uuid primary key default gen_random_uuid(),
  method text not null check (char_length(method) between 1 and 60),
  percent numeric not null check (percent between 0 and 100),
  valid_from date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (method, valid_from)
);
create index if not exists payment_fee_rates_created_by_idx on public.payment_fee_rates (created_by);

-- ---------------------------------------------------------------------------
-- Usage réel des fournisseurs (une ligne par appel facturé : caractères, jetons, images, minutes…)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_usage (
  id bigint generated always as identity primary key,
  provider text not null check (provider ~ '^[a-z0-9_.-]{1,40}$'),
  service text not null default '' check (char_length(service) <= 60),
  units numeric not null check (units >= 0),
  user_id uuid references auth.users(id) on delete set null,
  ref text check (ref is null or char_length(ref) <= 120),   -- identifiant de la tâche chez le fournisseur, pour recouper
  created_at timestamptz not null default now()
);
create index if not exists provider_usage_created_at_idx on public.provider_usage (created_at);
create index if not exists provider_usage_user_id_idx on public.provider_usage (user_id);

-- ---------------------------------------------------------------------------
-- Entrées d'argent hors passerelle et retraits, avec leur motif
-- ---------------------------------------------------------------------------
create table if not exists public.money_adjustments (
  id uuid primary key default gen_random_uuid(),
  reason text not null check (reason in (
    'vente_manuelle', 'collaboration', 'don', 'correction',              -- entrées (crédits ou accès donnés)
    'remboursement', 'reprise_don', 'fin_collaboration', 'autre_retrait' -- retraits
  )),
  user_id uuid references auth.users(id) on delete set null,
  customer_label text check (customer_label is null or char_length(customer_label) <= 120),
  credits integer check (credits is null or credits >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),  -- encaissé (ou rendu, pour un remboursement), dans sa devise
  paid_currency text not null default 'XAF' check (paid_currency in ('XAF', 'EUR', 'USD')),
  paid_fcfa numeric not null default 0 check (paid_fcfa >= 0),
  list_price_fcfa numeric not null default 0 check (list_price_fcfa >= 0),  -- valeur au prix du site au moment de l'ajout
  payment_method text check (payment_method is null or char_length(payment_method) <= 60),
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists money_adjustments_occurred_at_idx on public.money_adjustments (occurred_at);
create index if not exists money_adjustments_user_id_idx on public.money_adjustments (user_id);
create index if not exists money_adjustments_created_by_idx on public.money_adjustments (created_by);

-- Commandes payées lues par période (page Revenus).
create index if not exists orders_paid_at_idx on public.orders (paid_at) where status = 'success';

-- ---------------------------------------------------------------------------
-- Sécurité : RLS partout, lecture admin seulement, aucune écriture depuis le navigateur
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['finance_charges', 'provider_rates', 'payment_fee_rates', 'provider_usage', 'money_adjustments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins lisent" on public.%I', t);
    execute format('create policy "Admins lisent" on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.provider_usage_id_seq to service_role;
