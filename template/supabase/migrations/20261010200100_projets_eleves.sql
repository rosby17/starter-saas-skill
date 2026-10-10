-- 10/10 : PROJETS D'ÉLÈVES = preuve des résultats de la formation, et DISCUSSION avec les élèves.
--  · Un élève vérifié (même règle que les avis) joint la vidéo de son projet à son avis : publiée avec l'avis
--    (stockage privé « community », lue par lien signé), et dans le groupe « Avis des élèves ».
--  · L'admin ajoute aussi des projets reçus ailleurs (WhatsApp…) : user_id vide, nom saisi, vidéo dans public/.
--  · Chaque avis renvoie vers son message dans le groupe « Avis des élèves », désormais OUVERT à la discussion :
--    les membres échangent avec l'élève sur la formation.
-- Écriture uniquement par l'API (service) ; lecture publique par le serveur. Rejouable.

alter table public.course_reviews add column if not exists community_post_id uuid references public.community_posts(id) on delete set null;
create index if not exists course_reviews_post_idx on public.course_reviews (community_post_id);

create table if not exists public.student_projects (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid references public.course_reviews(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  video_url text,
  video_path text,
  poster_url text,
  aspect text not null default '16/9' check (aspect in ('16/9', '1/1', '9/16', '4/5')),
  hidden boolean not null default false,
  position int not null default 100,
  created_at timestamptz not null default now(),
  check (video_url is not null or video_path is not null)
);
create index if not exists student_projects_product_idx on public.student_projects (product_id, position, created_at desc);
create index if not exists student_projects_user_idx on public.student_projects (user_id);
create unique index if not exists student_projects_one_per_review on public.student_projects (review_id);
alter table public.student_projects enable row level security;
drop policy if exists "Auteur ou admin lit le projet" on public.student_projects;
create policy "Auteur ou admin lit le projet" on public.student_projects for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.student_projects from anon, authenticated;
grant select on public.student_projects to authenticated;
grant all on public.student_projects to service_role;

update public.community_channels set mode = 'discussion',
  description = 'Avis vérifiés et projets des élèves. Réponds-leur, pose tes questions sur la formation.'
where slug = 'avis';
