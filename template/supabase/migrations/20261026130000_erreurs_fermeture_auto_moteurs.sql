-- Fiabilité : erreurs qui se ferment seules, moteurs IA, services en pause.
-- Relançable sans erreur.
--
-- 1. Fermeture sur succès (src/lib/monitoring/auto-resolve.ts, resolveErrorsOnSuccess) : à chaque succès d'une action
--    qui a des erreurs ouvertes, on ferme « action = … et resolved_at is null ». Index partiel : seules les erreurs
--    ouvertes, peu nombreuses, y figurent.
create index if not exists error_logs_open_action_idx on public.error_logs (action, created_at) where resolved_at is null;

-- 2. Réglages des moteurs, services en pause et état de la sonde : lignes de public.system_settings (table existante,
--    RLS déjà activée, lecture publique limitée à la clé « maintenance »). Lus et écrits uniquement par le serveur
--    (client service) : aucune policy à ajouter. Valeurs de départ explicites (bascule et sonde COUPÉES) ; une ligne
--    déjà réglée n'est jamais écrasée.
insert into public.system_settings (key, value)
values
  ('engine_routing', '{"active": {}, "autoFallback": false, "watchdog": false}'::jsonb),
  ('service_outages', '{}'::jsonb)
on conflict (key) do nothing;

alter table public.system_settings enable row level security;
