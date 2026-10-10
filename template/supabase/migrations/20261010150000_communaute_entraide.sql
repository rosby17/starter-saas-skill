-- 10/10 : la communauté devient une COMMUNAUTÉ WhatsApp avec des GROUPES :
--  · « Annonces » (mode annonces) : seul l'administrateur écrit ; les membres lisent, réagissent, votent ;
--  · « communauté Discussion » (mode discussion) : tous les membres écrivent, partagent, s'entraident ;
--  · d'autres groupes créés par l'admin. Tous les membres ont accès à tous les groupes.
-- Membres : l'admin, les abonnés communauté ET toute personne qui a une formation à vie (bénéfice des formations).
-- Rejouable.

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
         or (p.category = 'formation' and e.expires_at is null))
  )
$$;

create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  mode text not null default 'discussion' check (mode in ('annonces', 'discussion')),
  position integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.community_channels enable row level security;
drop policy if exists "Membres voient les groupes" on public.community_channels;
create policy "Membres voient les groupes" on public.community_channels for select using (public.has_community_access());
revoke insert, update, delete on public.community_channels from anon, authenticated;
grant select on public.community_channels to authenticated;
grant all on public.community_channels to service_role;

insert into public.community_channels (slug, name, description, mode, position) values
  ('annonces', 'Annonces', 'Mes annonces, astuces et coulisses. Seul l’administrateur écrit ici.', 'annonces', 0),
  ('discussion', 'Discussion', 'On parle ensemble : questions, partages, entraide entre membres.', 'discussion', 10)
on conflict (slug) do nothing;

alter table public.community_posts add column if not exists channel_id uuid references public.community_channels(id) on delete cascade;
update public.community_posts set channel_id = (select id from public.community_channels where slug = 'annonces') where channel_id is null;
alter table public.community_posts alter column channel_id set not null;
create index if not exists community_posts_channel_idx on public.community_posts (channel_id, created_at desc);

-- Écrire : l'admin partout ; un membre seulement dans un groupe « discussion », message simple, pour lui-même.
drop policy if exists "Admin publie" on public.community_posts;
create policy "Admin publie" on public.community_posts for insert with check (
  author_id = auth.uid() and (
    public.is_admin()
    or (kind = 'post' and not pinned and public.has_community_access()
        and exists (select 1 from public.community_channels c where c.id = channel_id and c.mode = 'discussion'))
  )
);

-- Réactions et votes : sur tout message que le membre peut lire.
drop policy if exists "Membres réagissent" on public.community_reactions;
create policy "Membres réagissent" on public.community_reactions for insert with check (user_id = auth.uid() and public.has_community_access());
