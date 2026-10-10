-- 09/10 : nouveau catalogue « formation + accompagnement » et abonnement « Rester à jour ».
--  · Chaque offre existe en FORMATION (vidéos + questions) et en ACCOMPAGNEMENT (sur ton projet, inclut la formation).
--  · L'abonnement à 10 000 / mois ne donne PLUS tous les cours : il garde à jour (nouveaux modules, nouveautés)
--    toutes les formations que l'élève possède. Les abonnements en cours sont gardés tels quels.
--  · Pack « Toutes les formations » à 200 000 (achat unique).
-- Rejouable.

-- ---------------------------------------------------------------------------
-- 1. Règles d'accès : l'abonnement n'ouvre plus les cours non achetés.
-- ---------------------------------------------------------------------------
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
  )
$$;
revoke all on function public.has_access(uuid) from public, anon;
grant execute on function public.has_access(uuid) to authenticated, service_role;

-- Une leçon : il faut posséder le cours à vie, ET (leçon sortie avant l'achat, OU abonnement aux mises à jour
-- de ce cours, OU abonnement « Rester à jour » de la plateforme).
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
         or public.has_platform_subscription()
         or exists (
           select 1 from public.entitlements e join public.products s on s.id = e.product_id
            where e.user_id = auth.uid() and e.revoked_at is null and e.expires_at > now() and s.updates_for = p.slug
         )
       )
  )
$$;
revoke all on function public.can_watch_lesson(uuid) from public, anon;
grant execute on function public.can_watch_lesson(uuid) to authenticated, service_role;
