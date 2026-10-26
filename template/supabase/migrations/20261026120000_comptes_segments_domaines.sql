-- COMPTES : segments, actions en lot, suspension avec motif, domaines d'e-mail jetables / sérieux. Rejouable.
--
-- 1. profiles : compte « interne » (équipe, testeurs : jamais suspendu en lot, exclu des chiffres) et motif de suspension.
--    La suspension elle-même reste le bannissement Supabase Auth (auth.users.banned_until) : c'est lui qui bloque
--    la connexion. Les colonnes ci-dessous ne servent qu'à l'affichage et au journal.
-- 2. email_domain_rules : domaines BLOQUÉS (jetables, ou bloqués par l'admin) et domaines AUTORISÉS (site sérieux
--    vérifié : jamais classé suspect, même s'il figure dans la liste). Une seule table, lue par l'inscription,
--    par les segments et par les crédits de bienvenue.
-- 3. admin_list_accounts() : liste filtrée et paginée CÔTÉ BASE. Aucune liste d'identifiants dans l'URL de l'API
--    de données : une recherche large (« gmail », un indicatif) ne peut plus casser la page (« URI too long »).

-- 1. Profils -------------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists is_internal boolean not null default false;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles drop constraint if exists profiles_suspension_reason_len;
alter table public.profiles add constraint profiles_suspension_reason_len
  check (suspension_reason is null or char_length(suspension_reason) <= 60);

-- Un client peut modifier son profil (nom, téléphone…) mais jamais ces marques posées par l'administration.
create or replace function public.protect_account_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_internal := old.is_internal;
    new.suspension_reason := old.suspension_reason;
    new.suspended_at := old.suspended_at;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_account_flags on public.profiles;
create trigger profiles_protect_account_flags before update on public.profiles
  for each row execute function public.protect_account_flags();

create index if not exists profiles_internal_idx on public.profiles (id) where is_internal;

-- 2. Domaines d'e-mail -----------------------------------------------------------------------------------------------
create table if not exists public.email_domain_rules (
  domain text primary key check (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  kind text not null check (kind in ('blocked', 'allowed')),
  source text not null default 'admin' check (source in ('liste', 'admin')),
  reason text check (reason is null or char_length(reason) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists email_domain_rules_created_by_idx on public.email_domain_rules (created_by);
create index if not exists email_domain_rules_kind_idx on public.email_domain_rules (kind);
alter table public.email_domain_rules enable row level security;
drop policy if exists "Admins gèrent les domaines" on public.email_domain_rules;
create policy "Admins gèrent les domaines" on public.email_domain_rules for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.email_domain_rules from anon;
grant all on public.email_domain_rules to service_role;

-- Point de départ : les services d'adresses temporaires les plus courants. L'admin en ajoute (bouton « Bloquer
-- le domaine ») ou en retire ; un domaine « allowed » l'emporte toujours. Pour une liste exhaustive (> 100 000
-- domaines), voir references/comptes-et-credits.md.
insert into public.email_domain_rules (domain, kind, source, reason)
select d, 'blocked', 'liste', 'Adresse temporaire (liste du kit)'
from unnest(array[
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'grr.la',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.org', 'jetable.fr.nf', 'temp-mail.org',
  'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'tempr.email', 'trashmail.com',
  'trashmail.de', 'trashmail.net', '10minutemail.com', '10minutemail.net', '20minutemail.com', 'minutemail.com',
  'throwawaymail.com', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com',
  'mailcatch.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
  'spamgourmet.com', 'spambox.us', 'mytemp.email', 'moakt.com', 'tmail.ws', 'tmpmail.org', 'tmpmail.net',
  'burnermail.io', 'inboxkitten.com', 'mail.tm', 'mailpoof.com', 'emailfake.com', 'luxusmail.org',
  'disposablemail.com', 'discard.email', 'harakirimail.com', 'mailsac.com', 'mvrht.net', 'byom.de',
  'trbvm.com', 'dropmail.me', '1secmail.com', '1secmail.net', '1secmail.org', 'kzccv.com', 'qiott.com',
  'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com', 'vjuum.com', 'laafd.com', 'txcct.com', 'rteet.com',
  'dpptd.com', 'bheps.com'
]) as d
on conflict (domain) do nothing;

-- Vrai si l'adresse appartient à un domaine bloqué et non autorisé à part. Lue par l'inscription (serveur).
create or replace function public.email_domain_blocked(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.email_domain_rules r
    where r.domain = lower(split_part(coalesce(p_email, ''), '@', 2)) and r.kind = 'blocked'
  ) and not exists (
    select 1 from public.email_domain_rules r
    where r.domain = lower(split_part(coalesce(p_email, ''), '@', 2)) and r.kind = 'allowed'
  );
$$;
revoke all on function public.email_domain_blocked(text) from public, anon, authenticated;
grant execute on function public.email_domain_blocked(text) to service_role;

-- 3. Liste des comptes avec leurs segments -------------------------------------------------------------------------
-- Activité RÉELLE (pas la simple connexion) : consommation de crédits, commande payée, leçon ouverte.
--   active   : dans les 30 derniers jours ; inactive : déjà actif, plus rien depuis ; dormant : jamais actif.
-- spent : a déjà payé une commande OU consommé des crédits. suspect : domaine bloqué (et non autorisé).
-- Recherche : nom, e-mail, et TÉLÉPHONE par ses chiffres (« 6 99 12 », « +237699… » et « 0699… » se retrouvent).
create or replace function public.admin_list_accounts(
  p_q text default '',
  p_activity text default 'all',   -- all | active | inactive | dormant | ever
  p_spent text default 'all',      -- all | yes | no
  p_risk text default 'all',       -- all | suspect | clean
  p_account text default 'live',   -- live | suspended | internal | all
  p_limit integer default 30,
  p_offset integer default 0,
  p_ids_only boolean default false, -- vrai : renvoie TOUTES les lignes (actions en lot « tout le filtre »), plafonnées à 5 000
  p_ids uuid[] default null          -- comptes cochés : passés dans le CORPS de l'appel RPC, jamais dans une URL
)
returns table (
  id uuid, email text, full_name text, phone text, country text, is_admin boolean, is_internal boolean,
  created_at timestamptz, last_sign_in_at timestamptz, last_activity_at timestamptz, activity text,
  spent boolean, suspended boolean, suspension_reason text, suspect boolean, domain text, total_count bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with q as (
    select lower(trim(coalesce(p_q, ''))) as raw,
           '%' || replace(replace(replace(lower(trim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits
  ),
  base as (
    select u.id, u.email::text as email, p.full_name, p.phone, p.country, coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_internal, false) as is_internal, u.created_at, u.last_sign_in_at,
           (u.banned_until is not null and u.banned_until > now()) as suspended, p.suspension_reason,
           lower(split_part(coalesce(u.email, ''), '@', 2)) as domain
    from auth.users u
    left join public.profiles p on p.id = u.id
    cross join q
    where (p_ids is null or u.id = any(p_ids))
      and (q.raw = ''
       or lower(coalesce(u.email, '')) like q.pattern escape '\'
       or lower(coalesce(p.full_name, '')) like q.pattern escape '\'
       -- Téléphone : comparaison sur les seuls chiffres, sans l'indicatif ni le 0 de tête (3 chiffres minimum).
       or (length(q.digits) >= 3 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || ltrim(q.digits, '0') || '%'))
  ),
  enriched as (
    select b.*,
           greatest(
             (select max(c.created_at) from public.credits c where c.user_id = b.id and c.amount < 0 and c.source not in ('expiry', 'admin_adjustment')),
             (select max(o.created_at) from public.orders o where o.user_id = b.id and o.status = 'success'),
             (select max(la.last_seen) from public.lesson_activity la where la.user_id = b.id)
           ) as last_activity_at,
           (exists (select 1 from public.orders o where o.user_id = b.id and o.status = 'success')
             or exists (select 1 from public.credits c where c.user_id = b.id and c.amount < 0 and c.source not in ('expiry', 'admin_adjustment'))) as spent,
           (exists (select 1 from public.email_domain_rules r where r.domain = b.domain and r.kind = 'blocked')
             and not exists (select 1 from public.email_domain_rules r where r.domain = b.domain and r.kind = 'allowed')) as suspect
    from base b
  ),
  segmented as (
    select e.*,
           case when e.last_activity_at is null then 'dormant'
                when e.last_activity_at > now() - interval '30 days' then 'active'
                else 'inactive' end as activity
    from enriched e
  ),
  filtered as (
    select s.* from segmented s
    where (p_account = 'all'
           or (p_account = 'live' and not s.suspended)
           or (p_account = 'suspended' and s.suspended)
           or (p_account = 'internal' and s.is_internal))
      and (p_activity = 'all'
           or (p_activity = 'ever' and s.activity <> 'dormant')
           or s.activity = p_activity)
      and (p_spent = 'all' or (p_spent = 'yes' and s.spent) or (p_spent = 'no' and not s.spent))
      and (p_risk = 'all' or (p_risk = 'suspect' and s.suspect) or (p_risk = 'clean' and not s.suspect))
  )
  select f.id, f.email, f.full_name, f.phone, f.country, f.is_admin, f.is_internal, f.created_at, f.last_sign_in_at,
         f.last_activity_at, f.activity, f.spent, f.suspended, f.suspension_reason, f.suspect, f.domain,
         count(*) over () as total_count
  from filtered f
  order by f.created_at desc
  limit case when p_ids_only then 5000 else greatest(1, least(coalesce(p_limit, 30), 100)) end
  offset case when p_ids_only then 0 else greatest(0, coalesce(p_offset, 0)) end;
$$;
revoke all on function public.admin_list_accounts(text, text, text, text, text, integer, integer, boolean, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_list_accounts(text, text, text, text, text, integer, integer, boolean, uuid[]) to service_role;

-- Compteurs des onglets (une seule lecture). « users » = comptes non suspendus : le chiffre à montrer partout.
create or replace function public.admin_account_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'total', count(*),
    'users', count(*) filter (where not suspended),
    'suspended', count(*) filter (where suspended),
    'internal', count(*) filter (where is_internal),
    'suspect_live', count(*) filter (where suspect and not suspended)
  )
  from (
    select (u.banned_until is not null and u.banned_until > now()) as suspended,
           coalesce(p.is_internal, false) as is_internal,
           (exists (select 1 from public.email_domain_rules r where r.domain = lower(split_part(coalesce(u.email, ''), '@', 2)) and r.kind = 'blocked')
             and not exists (select 1 from public.email_domain_rules r where r.domain = lower(split_part(coalesce(u.email, ''), '@', 2)) and r.kind = 'allowed')) as suspect
    from auth.users u left join public.profiles p on p.id = u.id
  ) t;
$$;
revoke all on function public.admin_account_counts() from public, anon, authenticated;
grant execute on function public.admin_account_counts() to service_role;

-- Accélère les sous-requêtes d'activité.
create index if not exists credits_user_debit_idx on public.credits (user_id, created_at desc) where amount < 0;
create index if not exists orders_user_success_idx on public.orders (user_id, created_at desc) where status = 'success';
create index if not exists lesson_activity_user_seen_idx on public.lesson_activity (user_id, last_seen desc);
