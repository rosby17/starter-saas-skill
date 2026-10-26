-- CRÉDITS : justification visible par le client, proposition de recharge au solde faible, crédits de bienvenue
-- réglables, fenêtre de gratuité d'un service. Rejouable.
--
-- Réglages (system_settings, lus par le serveur avec la clé service ; modifiés dans Administration › Crédits) :
--   recharge_nudge  {"threshold": 500, "snoozeDays": 3}          seuil du « solde faible » et pause après « Plus tard »
--   welcome_credits {"amount": 0, "validityDays": null}          crédits offerts à chaque nouveau compte (0 = coupé)
--   free_window     {"services": [], "until": null, "label": ""}  services gratuits jusqu'à une date (« illimité »)

-- 1. Justification d'un ajustement admin, montrée au client (« Vous avez reçu des crédits ») ----------------------
alter table public.credits add column if not exists note text;
alter table public.credits drop constraint if exists credits_note_len;
alter table public.credits add constraint credits_note_len check (note is null or char_length(note) <= 300);
create index if not exists credits_user_admin_idx on public.credits (user_id, created_at desc) where source = 'admin_adjustment';

-- 2. Réglages par défaut (jamais écrasés s'ils existent déjà) ------------------------------------------------------
insert into public.system_settings (key, value) values
  ('recharge_nudge', '{"threshold": 500, "snoozeDays": 3}'::jsonb),
  ('welcome_credits', '{"amount": 0, "validityDays": null}'::jsonb),
  ('free_window', '{"services": [], "until": null, "label": ""}'::jsonb)
on conflict (key) do nothing;

-- 3. Suivi de la proposition de recharge ------------------------------------------------------------------------------
-- Une ligne par événement : affichée, refusée (« Plus tard »), cliquée. Le paiement réussi n'est PAS écrit ici :
-- il est rapproché à la lecture (commande de crédits payée dans les 72 h qui suivent un clic), ce qui évite de
-- toucher au circuit de paiement verrouillé. Aucune donnée de paiement.
create table if not exists public.recharge_nudge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('shown', 'dismissed', 'clicked')),
  placement text check (placement is null or placement in ('banner', 'credits_page')),
  pack text check (pack is null or char_length(pack) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists recharge_nudge_events_user_idx on public.recharge_nudge_events (user_id, created_at desc);
create index if not exists recharge_nudge_events_event_idx on public.recharge_nudge_events (event, created_at desc);
alter table public.recharge_nudge_events enable row level security;
drop policy if exists "Admins lisent le suivi de recharge" on public.recharge_nudge_events;
create policy "Admins lisent le suivi de recharge" on public.recharge_nudge_events for select using (public.is_admin());
revoke all on public.recharge_nudge_events from anon, authenticated;
grant select on public.recharge_nudge_events to authenticated;
grant all on public.recharge_nudge_events to service_role;

-- Conversion sur N jours : affichages, refus, clics, et paiements de crédits réussis dans les 72 h d'un clic.
create or replace function public.admin_recharge_nudge_stats(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with since as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as at),
  ev as (select e.* from public.recharge_nudge_events e, since where e.created_at >= since.at)
  select jsonb_build_object(
    'shown', (select count(*) from ev where event = 'shown'),
    'dismissed', (select count(*) from ev where event = 'dismissed'),
    'clicked', (select count(*) from ev where event = 'clicked'),
    'paid', (
      select count(distinct o.id) from public.orders o
      where o.status = 'success' and o.credits > 0
        and exists (select 1 from ev where ev.event = 'clicked' and ev.user_id = o.user_id
                      and o.created_at between ev.created_at and ev.created_at + interval '72 hours')
    )
  );
$$;
revoke all on function public.admin_recharge_nudge_stats(integer) from public, anon, authenticated;
grant execute on function public.admin_recharge_nudge_stats(integer) to service_role;

-- 4. Crédits de bienvenue à l'inscription (coupés tant que amount = 0) ---------------------------------------------
-- Une seule fois par compte (index unique), jamais pour une adresse jetable (email_domain_blocked, migration 120000).
create unique index if not exists credits_one_signup_bonus on public.credits (user_id) where source = 'signup_bonus';

create or replace function public.grant_welcome_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
  amount integer;
  days integer;
begin
  select value into cfg from public.system_settings where key = 'welcome_credits';
  amount := coalesce((cfg->>'amount')::integer, 0);
  if amount <= 0 or amount > 1000000 then return new; end if;
  if public.email_domain_blocked(new.email) then return new; end if;
  days := nullif(cfg->>'validityDays', '')::integer;
  insert into public.credits (user_id, amount, source, expires_at)
  values (new.id, amount, 'signup_bonus', case when days between 1 and 3660 then now() + make_interval(days => days) end)
  on conflict do nothing;
  return new;
exception when others then
  -- Un réglage mal saisi ne doit JAMAIS empêcher une inscription.
  raise warning 'grant_welcome_credits : %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.grant_welcome_credits() from public, anon, authenticated;

drop trigger if exists on_auth_user_welcome_credits on auth.users;
create trigger on_auth_user_welcome_credits after insert on auth.users
  for each row execute function public.grant_welcome_credits();

-- 5. Solde calculé dans la base ----------------------------------------------------------------------------------------
-- L'API de données plafonne une lecture à 1 000 lignes : additionner le registre côté serveur donnait un solde faux
-- pour un client très actif. Lue par getCreditsBalance() (lib/credits/balance.ts) avec la clé service.
create or replace function public.credits_balance(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::bigint from public.credits where user_id = p_user_id;
$$;
revoke all on function public.credits_balance(uuid) from public, anon, authenticated;
grant execute on function public.credits_balance(uuid) to service_role;
