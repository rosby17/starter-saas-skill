-- Recherche d'utilisateurs pour l'administration (suggestions pendant la frappe : nom ou e-mail).
-- L'e-mail vit dans auth.users, invisible pour l'API de données : cette fonction le joint au profil.
-- Réservée au serveur (clé service, derrière requireAdmin) : aucun droit pour anon / authenticated. Rejouable.

create or replace function public.admin_search_users(search text default '', max_results integer default 8)
returns table (id uuid, email text, first_name text, is_admin boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  with q as (
    -- % et _ tapés par l'admin sont cherchés tels quels (pas comme jokers).
    select lower(trim(coalesce(search, ''))) as raw,
           '%' || replace(replace(replace(lower(trim(coalesce(search, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select u.id, u.email::text, p.first_name, coalesce(p.is_admin, false), u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join q
  where q.raw = ''
     or lower(u.email) like q.pattern escape '\'
     or lower(coalesce(p.first_name, '')) like q.pattern escape '\'
  order by
    (q.raw <> '' and (lower(u.email) like q.raw || '%' or lower(coalesce(p.first_name, '')) like q.raw || '%')) desc,
    u.created_at desc
  limit greatest(1, least(coalesce(max_results, 8), 100));
$$;

revoke all on function public.admin_search_users(text, integer) from public, anon, authenticated;
grant execute on function public.admin_search_users(text, integer) to service_role;
