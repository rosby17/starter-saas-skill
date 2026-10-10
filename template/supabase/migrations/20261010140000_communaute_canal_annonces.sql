-- 10/10 : la communauté devient un CANAL D'ANNONCES comme sur WhatsApp :
-- seul l'administrateur (admin) publie (textes, photos, vidéos, fichiers, vocaux, sondages, événements) ;
-- les membres lisent, réagissent avec un emoji et votent aux sondages. Rejouable.

alter table public.community_posts add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.community_posts drop constraint if exists community_posts_kind_check;
alter table public.community_posts add constraint community_posts_kind_check check (kind in ('post', 'annonce', 'astuce', 'poll', 'event'));

-- Publier : administrateur seulement.
drop policy if exists "Membres publient" on public.community_posts;
drop policy if exists "Admin publie" on public.community_posts;
create policy "Admin publie" on public.community_posts for insert with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "Auteur ou admin modifie" on public.community_posts;
drop policy if exists "Admin modifie" on public.community_posts;
create policy "Admin modifie" on public.community_posts for update using (public.is_admin()) with check (public.is_admin());

-- Commentaires : fermés aux membres (canal d'annonces). Les anciens restent lisibles.
drop policy if exists "Membres commentent" on public.community_comments;
drop policy if exists "Admin commente" on public.community_comments;
create policy "Admin commente" on public.community_comments for insert with check (public.is_admin() and author_id = auth.uid());

-- Réaction : un emoji par membre et par message (comme WhatsApp).
alter table public.community_reactions add column if not exists emoji text not null default '❤️';
alter table public.community_reactions drop constraint if exists community_reactions_emoji_check;
alter table public.community_reactions add constraint community_reactions_emoji_check check (char_length(emoji) between 1 and 16);
drop policy if exists "Membres changent leur réaction" on public.community_reactions;
create policy "Membres changent leur réaction" on public.community_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_community_access());

-- Sondages : un vote par option cochée (meta.multiple = plusieurs choix permis).
create table if not exists public.community_poll_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option smallint not null check (option between 0 and 11),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, option)
);
create index if not exists community_poll_votes_user_idx on public.community_poll_votes (user_id);
alter table public.community_poll_votes enable row level security;
drop policy if exists "Membres lisent les votes" on public.community_poll_votes;
create policy "Membres lisent les votes" on public.community_poll_votes for select using (public.has_community_access());
drop policy if exists "Membres votent" on public.community_poll_votes;
create policy "Membres votent" on public.community_poll_votes for insert with check (public.has_community_access() and user_id = auth.uid());
drop policy if exists "Membres retirent leur vote" on public.community_poll_votes;
create policy "Membres retirent leur vote" on public.community_poll_votes for delete using (user_id = auth.uid());
grant select, insert, delete on public.community_poll_votes to authenticated;
grant all on public.community_poll_votes to service_role;
grant update on public.community_reactions to authenticated;
