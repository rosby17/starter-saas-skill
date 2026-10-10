-- 10/10 : statistiques des formations, pour savoir ce qui marche et améliorer les prochaines.
--  · Temps passé par élève et par leçon (envoyé par le lecteur toutes les 30 s tant que la leçon est ouverte et visible).
--  · Visites des fiches produit (par jour), pour comparer intérêt et ventes.
-- Écriture uniquement par des fonctions contrôlées (jamais d'écriture directe depuis le navigateur). Rejouable.

create table if not exists public.lesson_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  seconds integer not null default 0 check (seconds >= 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_activity_product_idx on public.lesson_activity (product_id);
create index if not exists lesson_activity_lesson_idx on public.lesson_activity (lesson_id);
alter table public.lesson_activity enable row level security;
drop policy if exists "Admins lisent l'activité" on public.lesson_activity;
create policy "Admins lisent l'activité" on public.lesson_activity for select using (public.is_admin());
revoke insert, update, delete on public.lesson_activity from anon, authenticated;
grant select on public.lesson_activity to authenticated;
grant all on public.lesson_activity to service_role;

-- Le lecteur envoie le temps passé (au plus 60 s par appel) ; refusé si l'élève n'a pas accès à la leçon.
create or replace function public.track_lesson_time(p_lesson_id uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s integer := least(greatest(coalesce(p_seconds, 0), 0), 60);
  pid uuid;
begin
  if auth.uid() is null or s = 0 or not public.can_watch_lesson(p_lesson_id) then return; end if;
  select product_id into pid from public.lessons where id = p_lesson_id;
  insert into public.lesson_activity (user_id, lesson_id, product_id, seconds)
  values (auth.uid(), p_lesson_id, pid, s)
  on conflict (user_id, lesson_id) do update set seconds = public.lesson_activity.seconds + s, last_seen = now();
end;
$$;
revoke all on function public.track_lesson_time(uuid, integer) from public, anon;
grant execute on function public.track_lesson_time(uuid, integer) to authenticated;

create table if not exists public.product_views (
  product_id uuid not null references public.products(id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  primary key (product_id, day)
);
alter table public.product_views enable row level security;
drop policy if exists "Admins lisent les visites" on public.product_views;
create policy "Admins lisent les visites" on public.product_views for select using (public.is_admin());
revoke insert, update, delete on public.product_views from anon, authenticated;
grant select on public.product_views to authenticated;
grant all on public.product_views to service_role;

create or replace function public.track_product_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.product_views (product_id, day, views)
  select id, current_date, 1 from public.products where slug = p_slug and published
  on conflict (product_id, day) do update set views = public.product_views.views + 1
$$;
revoke all on function public.track_product_view(text) from public;
grant execute on function public.track_product_view(text) to anon, authenticated;
