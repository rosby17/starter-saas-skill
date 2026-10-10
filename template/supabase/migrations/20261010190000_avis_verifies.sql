-- 10/10 : AVIS VÉRIFIÉS sur les formations, façon Trustpilot.
--  · Seul un élève qui a vraiment acheté (accès à vie, pas un essai) ET commencé le cours peut donner son avis.
--  · Chaque avis est publié tout de suite, positif ou négatif, sans filtre ; l'admin peut seulement masquer un avis
--    extrême (motif noté). La progression de l'élève au moment de l'avis est affichée (« a suivi 80 % »).
--  · Les avis sont aussi publiés dans le groupe « Avis des élèves » de la communauté.
-- Écriture uniquement par l'API (contrôles côté serveur) ; lecture publique par le serveur. Rejouable.

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 2000),
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists course_reviews_product_idx on public.course_reviews (product_id, created_at desc);
alter table public.course_reviews enable row level security;
drop policy if exists "Auteur ou admin lit l'avis" on public.course_reviews;
create policy "Auteur ou admin lit l'avis" on public.course_reviews for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.course_reviews from anon, authenticated;
grant select on public.course_reviews to authenticated;
grant all on public.course_reviews to service_role;

insert into public.community_channels (slug, name, description, mode, position)
values ('avis', 'Avis des élèves', 'Les avis vérifiés des élèves sur les formations, publiés sans filtre.', 'annonces', 5)
on conflict (slug) do nothing;
