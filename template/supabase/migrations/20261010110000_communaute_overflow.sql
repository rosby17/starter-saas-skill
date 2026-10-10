-- 10/10 : la communauté, réservée aux abonnés (produit « communaute », abonnement mensuel).
-- Un fil comme une communauté WhatsApp : l'administrateur publie annonces, astuces, textes, photos et vidéos ;
-- les abonnés réagissent, commentent et publient aussi. Médias dans le stockage PRIVÉ « community » (liens signés).
-- Accès : administrateur, ou abonnement en cours au produit. Rejouable.

create or replace function public.has_community_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.entitlements e join public.products p on p.id = e.product_id
     where p.slug = 'communaute' and e.user_id = auth.uid() and e.revoked_at is null
       and (e.expires_at is null or e.expires_at > now())
  )
$$;
revoke all on function public.has_community_access() from public, anon;
grant execute on function public.has_community_access() to authenticated;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'annonce', 'astuce')),
  body text not null default '' check (char_length(body) <= 8000),
  media jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
create index if not exists community_comments_author_idx on public.community_comments (author_id);

create table if not exists public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists community_reactions_user_idx on public.community_reactions (user_id);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;

-- Lecture : membres. Écriture : membres, pour eux-mêmes (les annonces, astuces et épingles : admin seulement).
drop policy if exists "Membres lisent les posts" on public.community_posts;
create policy "Membres lisent les posts" on public.community_posts for select using (public.has_community_access());
drop policy if exists "Membres publient" on public.community_posts;
create policy "Membres publient" on public.community_posts for insert
  with check (public.has_community_access() and author_id = auth.uid() and ((kind = 'post' and not pinned) or public.is_admin()));
drop policy if exists "Auteur ou admin modifie" on public.community_posts;
create policy "Auteur ou admin modifie" on public.community_posts for update
  using (author_id = auth.uid() or public.is_admin())
  with check ((author_id = auth.uid() and kind = 'post' and not pinned) or public.is_admin());
drop policy if exists "Auteur ou admin supprime" on public.community_posts;
create policy "Auteur ou admin supprime" on public.community_posts for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "Membres lisent les commentaires" on public.community_comments;
create policy "Membres lisent les commentaires" on public.community_comments for select using (public.has_community_access());
drop policy if exists "Membres commentent" on public.community_comments;
create policy "Membres commentent" on public.community_comments for insert with check (public.has_community_access() and author_id = auth.uid());
drop policy if exists "Auteur ou admin supprime le commentaire" on public.community_comments;
create policy "Auteur ou admin supprime le commentaire" on public.community_comments for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "Membres lisent les réactions" on public.community_reactions;
create policy "Membres lisent les réactions" on public.community_reactions for select using (public.has_community_access());
drop policy if exists "Membres réagissent" on public.community_reactions;
create policy "Membres réagissent" on public.community_reactions for insert with check (public.has_community_access() and user_id = auth.uid());
drop policy if exists "Membres retirent leur réaction" on public.community_reactions;
create policy "Membres retirent leur réaction" on public.community_reactions for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.community_posts, public.community_comments, public.community_reactions to authenticated;
grant all on public.community_posts, public.community_comments, public.community_reactions to service_role;

-- Médias de la communauté : stockage privé, lu par liens signés générés côté serveur.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('community', 'community', false, 209715200)
    on conflict (id) do nothing;
  end if;
end;
$$;
