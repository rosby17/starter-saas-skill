-- 09/10 : la formation devient un PARCOURS pédagogique, avec un questionnaire d’accueil.
-- · Les leçons sont rangées par module (section), ont un objectif (summary) et un contenu en étapes (blocks) :
--   texte, vidéos de référence, avant / après, écoutes de voix, images, encadrés, exercice, mini-quiz.
--   Les médias des étapes sont dans le stockage PRIVÉ « videos » (<produit>/<chemin>), lus par lien signé court.
-- · À la première entrée dans un cours, l'élève répond à un court questionnaire (course_onboarding).
-- Rejouable.

alter table public.lessons add column if not exists section text;
alter table public.lessons add column if not exists summary text;
alter table public.lessons add column if not exists blocks jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Questionnaire d'accueil d'un cours : une ligne par élève et par cours.
-- ---------------------------------------------------------------------------
create table if not exists public.course_onboarding (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists course_onboarding_product_idx on public.course_onboarding (product_id);
alter table public.course_onboarding enable row level security;

drop policy if exists "Élèves lisent leur accueil" on public.course_onboarding;
create policy "Élèves lisent leur accueil" on public.course_onboarding for select
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Élèves remplissent leur accueil" on public.course_onboarding;
create policy "Élèves remplissent leur accueil" on public.course_onboarding for insert
  with check (auth.uid() = user_id and (public.has_access(product_id) or public.is_admin()));
drop policy if exists "Élèves modifient leur accueil" on public.course_onboarding;
create policy "Élèves modifient leur accueil" on public.course_onboarding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (public.has_access(product_id) or public.is_admin()));

drop trigger if exists course_onboarding_updated_at on public.course_onboarding;
create trigger course_onboarding_updated_at before update on public.course_onboarding
  for each row execute function public.set_updated_at();

grant select, insert, update on public.course_onboarding to authenticated;
grant all on public.course_onboarding to service_role;

-- ---------------------------------------------------------------------------
-- Sommaire : ajoute le module (section) et l'objectif de chaque leçon.
-- Le contenu (description, étapes) d'une leçon verrouillée n'est toujours PAS renvoyé.
-- ---------------------------------------------------------------------------
drop function if exists public.course_outline(uuid);
create function public.course_outline(p_product_id uuid)
returns table (id uuid, lesson_position integer, section text, title text, summary text, description text, duration_seconds integer, released_at timestamptz, unlocked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.position, l.section, l.title, l.summary,
         case when public.is_admin() or public.can_watch_lesson(l.id) then l.description end,
         l.duration_seconds, l.released_at,
         public.is_admin() or public.can_watch_lesson(l.id)
    from public.lessons l
   where l.product_id = p_product_id
     and (public.is_admin() or public.has_access(p_product_id))
   order by l.position
$$;
revoke all on function public.course_outline(uuid) from public, anon;
grant execute on function public.course_outline(uuid) to authenticated, service_role;
