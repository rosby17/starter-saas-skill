# Règles de ce projet (générées par le skill starter-saas)

- **Branding et contenu de la landing** : `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ). Prix : `src/lib/pricing.ts`. Ne pas disperser ces textes ailleurs.
- **Menu de l'espace client** : `site.dashboardNav` dans `src/config/site.ts` ; chaque nouvelle page connectée y ajoute sa ligne.
- **Authentification** : Supabase. Déconnexion = `POST /auth/signout` (`LogoutButton`). Les pages privées sont protégées par `src/middleware.ts` ET revérifiées côté serveur avec `getUser()`.
- **Administration** : `/admin`, réservé à `profiles.is_admin = true` (à activer à la main sur son propre compte, dans Supabase).
- **Base de données** : uniquement par migrations dans `supabase/migrations/` : un fichier NEUF par changement (`AAAAMMJJHHMMSS_nom.sql`), jamais de modification d'une migration déjà appliquée. Toujours rejouables (`if not exists`, `drop policy if exists`), RLS activée sur chaque table, index sur chaque clé étrangère. Pour savoir quoi changer, lire l'état réel de la base (`supabase db diff`), pas sa mémoire.
- **Secrets** : jamais dans Git ni dans le chat. `.env.local` en local, variables d'environnement de l'hébergeur en production.
- **Vérifier avant de livrer** : `npx tsc --noEmit`, `npm run lint`, `npm run build`, puis essai réel dans le navigateur (inscription → connexion → action → déconnexion).
