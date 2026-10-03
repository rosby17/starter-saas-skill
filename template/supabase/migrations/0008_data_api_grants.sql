-- Droits d'accès de l'API de données (PostgREST).
-- Les projets Supabase récents ne donnent PLUS automatiquement les droits sur les tables du schéma public :
-- sans ces lignes, l'espace client voit tout vide (« permission denied ») et le serveur ne peut rien écrire.
-- La sécurité reste assurée par la RLS, activée sur chaque table : ces droits disent « qui peut tenter »,
-- les politiques RLS disent « sur quelles lignes ». Rejouable.

grant usage on schema public to anon, authenticated, service_role;

-- Serveur (clé service) : tout.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Utilisateurs connectés : lecture / écriture filtrées par la RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Visiteurs non connectés : lecture seule, filtrée par la RLS (annonces publiées, maintenance, taux de change).
grant select on all tables in schema public to anon;

-- Tables techniques : jamais accessibles hors serveur.
revoke all on public.cron_locks from anon, authenticated;
revoke all on public.app_secrets from anon, authenticated;   -- clés chiffrées (0007_app_secrets) : serveur uniquement
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

-- Mêmes droits pour les tables créées par les migrations suivantes.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant select on tables to anon;
