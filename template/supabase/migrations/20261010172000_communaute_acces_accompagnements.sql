-- 10/10 : les acheteurs d'un accompagnement sont aussi membres de la communauté. Rejouable.
create or replace function public.has_community_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.entitlements e join public.products p on p.id = e.product_id
     where e.user_id = auth.uid() and e.revoked_at is null
       and ((p.slug = 'communaute' and (e.expires_at is null or e.expires_at > now()))
         or (p.category in ('formation', 'accompagnement') and e.expires_at is null))
  )
$$;
