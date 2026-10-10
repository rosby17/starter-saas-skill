-- 08/10 : la plateforme passe aux abonnements.
--  · Un cours s'achète une fois et reste à vie dans la version achetée (les leçons publiées avant l'achat).
--  · L'abonnement d'un cours (mensuel) donne ses mises à jour : nouveaux modules, nouveautés IA, support.
--  · Le super abonnement (mensuel) ouvre TOUS les cours de la plateforme et toutes leurs mises à jour.
--  · Acheter un cours inclut son 1er mois d'abonnement ; les anciens acheteurs reçoivent 1 mois offert.
-- Mobile Money ne prélève pas automatiquement : un abonnement se renouvelle en le repayant (le temps s'ajoute).

-- ---------------------------------------------------------------------------
-- Produits : achat unique ou mensuel, abonnement d'un cours ou de toute la plateforme
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('formation', 'abonnement', 'accompagnement', 'logiciel', 'service', 'credits'));
alter table public.products add column if not exists billing text not null default 'one_time';
alter table public.products drop constraint if exists products_billing_check;
alter table public.products add constraint products_billing_check check (billing in ('one_time', 'monthly'));
alter table public.products add column if not exists period_days integer not null default 30;
alter table public.products drop constraint if exists products_period_days_check;
alter table public.products add constraint products_period_days_check check (period_days between 1 and 366);
alter table public.products add column if not exists covers_all boolean not null default false;  -- super abonnement
alter table public.products add column if not exists updates_for text;                           -- slug du cours mis à jour

-- ---------------------------------------------------------------------------
-- Accès : date de fin (null = à vie). Leçons : date de publication (sert à la « version achetée »).
-- ---------------------------------------------------------------------------
alter table public.entitlements add column if not exists expires_at timestamptz;
-- Rappels de renouvellement déjà envoyés pour CETTE date de fin (un renouvellement change la date → nouveaux rappels).
alter table public.entitlements add column if not exists reminded_soon_for timestamptz;
alter table public.entitlements add column if not exists reminded_expired_for timestamptz;
create index if not exists entitlements_user_active_idx on public.entitlements (user_id) where revoked_at is null;

alter table public.lessons add column if not exists released_at timestamptz;
-- Tout le contenu déjà en ligne fait partie de la « version de base » : acquis par tous les acheteurs, anciens et nouveaux
-- (les leçons ont souvent été créées APRÈS l'import des anciens acheteurs). Seules les leçons ajoutées à partir d'aujourd'hui
-- demandent un abonnement à ceux qui ont acheté avant leur sortie.
update public.lessons set released_at = '2026-01-01T00:00:00Z' where released_at is null;
alter table public.lessons alter column released_at set default now();
alter table public.lessons alter column released_at set not null;

-- ---------------------------------------------------------------------------
-- Super abonnement actif du client connecté ?
-- ---------------------------------------------------------------------------
create or replace function public.has_platform_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e join public.products s on s.id = e.product_id
     where e.user_id = auth.uid() and e.revoked_at is null and e.expires_at > now() and s.covers_all
  )
$$;
revoke all on function public.has_platform_subscription() from public, anon;
grant execute on function public.has_platform_subscription() to authenticated, service_role;

-- Accès à un produit : accès actif (à vie ou non expiré), ou super abonnement pour un cours.
create or replace function public.has_access(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
     where e.product_id = p_product_id and e.user_id = auth.uid() and e.revoked_at is null
       and (e.expires_at is null or e.expires_at > now())
  ) or (
    public.has_platform_subscription()
    and exists (select 1 from public.products p where p.id = p_product_id and p.category = 'formation' and p.billing = 'one_time')
  )
$$;
revoke all on function public.has_access(uuid) from public, anon;
grant execute on function public.has_access(uuid) to authenticated, service_role;

-- Peut-il regarder CETTE leçon ?
--  · super abonnement actif ;
--  · ou propriétaire à vie du cours ET (leçon publiée avant son achat OU abonnement aux mises à jour du cours actif).
create or replace function public.can_watch_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.lessons l
      join public.products p on p.id = l.product_id
      join public.entitlements own on own.product_id = p.id and own.user_id = auth.uid()
                                  and own.revoked_at is null and own.expires_at is null
     where l.id = p_lesson_id
       and (
         l.released_at <= own.created_at
         or exists (
           select 1 from public.entitlements e join public.products s on s.id = e.product_id
            where e.user_id = auth.uid() and e.revoked_at is null and e.expires_at > now() and s.updates_for = p.slug
         )
       )
  ) or (
    public.has_platform_subscription()
    and exists (select 1 from public.lessons l where l.id = p_lesson_id)
  )
$$;
revoke all on function public.can_watch_lesson(uuid) from public, anon;
grant execute on function public.can_watch_lesson(uuid) to authenticated, service_role;

drop policy if exists "Acheteurs lisent les leçons" on public.lessons;
create policy "Acheteurs lisent les leçons" on public.lessons for select
  using (public.can_watch_lesson(id) or public.is_admin());

-- Sommaire d'un cours pour qui y a accès : toutes les leçons, avec « débloquée » ou non (titres des nouveautés visibles).
drop function if exists public.course_outline(uuid);
create or replace function public.course_outline(p_product_id uuid)
returns table (id uuid, lesson_position integer, title text, description text, duration_seconds integer, released_at timestamptz, unlocked boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- Le texte d'une leçon verrouillée n'est PAS renvoyé (une leçon écrite serait lisible sans abonnement).
  select l.id, l.position, l.title,
         case when public.is_admin() or public.can_watch_lesson(l.id) then l.description end,
         l.duration_seconds, l.released_at,
         public.is_admin() or public.can_watch_lesson(l.id)
    from public.lessons l
   where l.product_id = p_product_id
     and (public.is_admin() or public.has_access(p_product_id))
   order by l.position
$$;
revoke all on function public.course_outline(uuid) from public, anon;
grant execute on function public.course_outline(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accorder un accès : un produit mensuel ajoute sa période à la date de fin (renouvellement cumulable).
-- ---------------------------------------------------------------------------
create or replace function public.grant_product_access(p_user_id uuid, p_product_id uuid, p_source text, p_order_id uuid default null, p_granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entitlements (user_id, product_id, order_id, source, granted_by, expires_at)
  select p_user_id, p.id, p_order_id, p_source, p_granted_by,
         case when p.billing = 'monthly' then now() + make_interval(days => p.period_days) end
    from public.products p
   where p.id = p_product_id
      or p.slug = any (select unnest(includes) from public.products where id = p_product_id)
  on conflict (user_id, product_id) do update
    set revoked_at = null,
        order_id = coalesce(public.entitlements.order_id, excluded.order_id),
        expires_at = case
          when excluded.expires_at is null then null
          else greatest(coalesce(public.entitlements.expires_at, now()), now())
               + (excluded.expires_at - now())
        end;
end;
$$;
revoke all on function public.grant_product_access(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_product_access(uuid, uuid, text, uuid, uuid) to service_role;
