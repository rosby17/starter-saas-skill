-- 09/10 : parcours personnalisé par l'IA (Claude via kie.ai) à partir du questionnaire d'accueil.
-- Le plan est écrit par le serveur seulement (clé service) ; l'élève le lit avec sa ligne (RLS existante). Rejouable.
alter table public.course_onboarding add column if not exists plan jsonb;
alter table public.course_onboarding add column if not exists plan_source text check (plan_source is null or plan_source in ('ia', 'regles'));
