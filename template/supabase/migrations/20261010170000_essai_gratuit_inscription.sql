-- ESSAI GRATUIT À L'INSCRIPTION (coupé par défaut). Tant que l'offre court (system_settings « signup_trial » :
-- produit, durée, date de fin), chaque nouvel inscrit reçoit un accès GRATUIT à une formation (version de base). Passé la durée, l'accès
-- se coupe tout seul ; s'il achète, son accès devient à vie. Réglage dans system_settings « signup_trial ». Rejouable.

alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check check (source in ('purchase', 'admin', 'import', 'trial'));

insert into public.system_settings (key, value)
values ('signup_trial', '{"product": null, "hours": 24, "until": null}'::jsonb)
on conflict (key) do nothing;

-- Lecture d'une leçon : accès à vie, OU essai gratuit encore valable (version de base seulement).
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
      join public.entitlements own on own.product_id = p.id and own.user_id = auth.uid() and own.revoked_at is null
                                  and (own.expires_at is null or (own.source = 'trial' and own.expires_at > now()))
     where l.id = p_lesson_id
       and (
         l.released_at <= own.created_at
         or (own.expires_at is null and public.has_platform_subscription())
         or exists (
           select 1 from public.entitlements e join public.products s on s.id = e.product_id
            where own.expires_at is null and e.user_id = auth.uid() and e.revoked_at is null and e.expires_at > now() and s.updates_for = p.slug
         )
       )
  )
$$;

-- Achat après un essai : l'accès devient « achat » (et à vie), plus « essai ».
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
        source = case when public.entitlements.source = 'trial' then excluded.source else public.entitlements.source end,
        order_id = coalesce(public.entitlements.order_id, excluded.order_id),
        expires_at = case
          when excluded.expires_at is null then null
          when public.entitlements.source = 'trial' then excluded.expires_at
          else greatest(coalesce(public.entitlements.expires_at, now()), now()) + (excluded.expires_at - now())
        end;
end;
$$;
revoke all on function public.grant_product_access(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_product_access(uuid, uuid, text, uuid, uuid) to service_role;

-- À l'inscription : essai offert si l'offre est en cours.
create or replace function public.grant_signup_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
  pid uuid;
begin
  select value into cfg from public.system_settings where key = 'signup_trial';
  if cfg is null or cfg->>'until' is null or now() > (cfg->>'until')::timestamptz then return new; end if;
  select id into pid from public.products where slug = cfg->>'product';
  if pid is null then return new; end if;
  insert into public.entitlements (user_id, product_id, source, expires_at)
  values (new.id, pid, 'trial', now() + make_interval(hours => coalesce((cfg->>'hours')::int, 24)))
  on conflict (user_id, product_id) do nothing;
  return new;
exception when others then
  return new; -- l'inscription ne doit jamais échouer à cause de l'offre
end;
$$;
drop trigger if exists on_auth_user_trial on auth.users;
create trigger on_auth_user_trial after insert on auth.users for each row execute function public.grant_signup_trial();
