-- Facturation et administration : validité des crédits, taux de change, journal d'audit, lecture admin.
-- Rejouable.

-- ---------------------------------------------------------------------------
-- Commandes : validité des crédits achetés, montant de référence en USD
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists validity_days integer;   -- null = les crédits n'expirent jamais
alter table public.orders add column if not exists amount_fcfa numeric;   -- montant réellement demandé à la passerelle (elles facturent en FCFA)

-- ---------------------------------------------------------------------------
-- Crédits : date d'expiration d'un lot acheté
-- ---------------------------------------------------------------------------
alter table public.credits add column if not exists expires_at timestamptz;
alter table public.credits add column if not exists expired_at timestamptz;   -- renseigné quand le lot a été traité par l'expiration
create index if not exists credits_expiry_idx on public.credits (expires_at)
  where amount > 0 and expired_at is null and expires_at is not null;

-- ---------------------------------------------------------------------------
-- Taux de change (mis à jour par le cron update-rates)
-- ---------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  currency_code text primary key,
  rate_to_usd numeric not null,
  updated_at timestamptz not null default now()
);
alter table public.exchange_rates enable row level security;
drop policy if exists "Anyone can read exchange rates" on public.exchange_rates;
create policy "Anyone can read exchange rates" on public.exchange_rates for select using (true);

-- ---------------------------------------------------------------------------
-- Journal d'audit : toute action admin sensible (valider un paiement, ajuster des crédits…)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Lecture admin : les pages /admin lisent avec la session de l'administrateur.
-- Sans ces politiques, la RLS ne lui montrait QUE ses propres lignes (liste des utilisateurs vide, etc.).
-- is_admin() est « security definer » pour ne pas boucler sur la RLS de profiles.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles for select using (public.is_admin());
drop policy if exists "Admins read all orders" on public.orders;
create policy "Admins read all orders" on public.orders for select using (public.is_admin());
drop policy if exists "Admins read all credits" on public.credits;
create policy "Admins read all credits" on public.credits for select using (public.is_admin());
drop policy if exists "Admins read audit log" on public.admin_audit_log;
create policy "Admins read audit log" on public.admin_audit_log for select using (public.is_admin());
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage system settings" on public.system_settings;
create policy "Admins manage system settings" on public.system_settings for all using (public.is_admin()) with check (public.is_admin());

-- Un utilisateur ne peut pas se donner les droits admin en modifiant son propre profil.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_is_admin_trg on public.profiles;
create trigger protect_is_admin_trg before update on public.profiles
  for each row execute function public.protect_is_admin();

-- ---------------------------------------------------------------------------
-- Crédit d'une commande payée (remplace la version 0004) : pose aussi la date d'expiration du lot.
-- ---------------------------------------------------------------------------
create or replace function public.credit_paid_order(p_order_id uuid, p_payment_ref text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.orders%rowtype;
begin
  update public.orders
     set status = 'success',
         payment_ref = coalesce(p_payment_ref, payment_ref)
   where id = p_order_id
     and status in ('pending', 'failed', 'expired')
  returning * into claimed;

  if not found then
    return false;
  end if;

  insert into public.credits (user_id, amount, source, order_id, expires_at)
  values (
    claimed.user_id, claimed.credits, 'purchase', claimed.id,
    case when claimed.validity_days is null then null else now() + make_interval(days => claimed.validity_days) end
  );
  return true;
end;
$$;
revoke all on function public.credit_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_paid_order(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Expiration des crédits : pour chaque lot échu, on retire du solde ce qui n'a pas été dépensé
-- (au plus le montant du lot, jamais sous zéro). Appelée par le cron expire-credits.
-- ---------------------------------------------------------------------------
create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  balance integer;
  to_expire integer;
  processed integer := 0;
begin
  for batch in
    select id, user_id, amount from public.credits
     where amount > 0 and expired_at is null and expires_at is not null and expires_at < now()
     order by expires_at, created_at
       for update skip locked
  loop
    select coalesce(sum(amount), 0) into balance from public.credits where user_id = batch.user_id;
    to_expire := least(batch.amount, greatest(balance, 0));
    update public.credits set expired_at = now() where id = batch.id;
    if to_expire > 0 then
      insert into public.credits (user_id, amount, source) values (batch.user_id, -to_expire, 'expiry');
      processed := processed + 1;
    end if;
  end loop;
  return processed;
end;
$$;
revoke all on function public.expire_credits() from public, anon, authenticated;
grant execute on function public.expire_credits() to service_role;
