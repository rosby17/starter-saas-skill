---
name: starter-saas
description: Crée un SaaS complet et opérationnel à partir d'une description (écrite ou dictée) : landing page, authentification avec déconnexion, espace client, administration, tarifs, migrations de base de données générées automatiquement, build vérifié et déploiement Docker. Utilise-le quand l'utilisateur dit « starter saas », « crée un SaaS », « nouveau SaaS » ou décrit une application web à fabriquer.
---

# starter-saas : de la description au SaaS qui tourne

Tu fabriques un SaaS à partir d'un modèle déjà prêt (dossier `template/` de ce skill) : l'utilisateur n'a plus à réexpliquer les routes, les connexions, l'authentification, les tableaux de bord ni la landing page. Il décrit son produit ; tu ne fais que l'adapter et ajouter ses fonctionnalités propres.

Réponds dans la langue de l'utilisateur. Le dossier de ce skill est indiqué au chargement (« Base directory ») : `template/` et `scripts/` y sont.

## Ce que contient le modèle

Next.js 15 (App Router) + Supabase + Tailwind + Docker :
- **Landing** (accueil, tarifs, FAQ, pages légales), SEO (`sitemap`, `robots`), pages 404 / erreur / chargement.
- **Authentification** : connexion, inscription, mot de passe oublié, **déconnexion** (`POST /auth/signout`), routes privées protégées.
- **Espace client** : menu latéral (tiroir sur téléphone), tableau de bord, mon compte (profil, mot de passe), aide (tickets), abonnement.
- **Administration** (`/admin`) : vue d'ensemble, utilisateurs, support, avis, annonces, mode maintenance.
- **Base de données** : migrations Supabase rejouables (profils, crédits, commandes, annonces, support, avis), sécurité par ligne (RLS) partout.
- **Paiement orchestré** (même flux pour tous tes SaaS) : le client choisit un TYPE de paiement (mobile money, carte, PayPal), l'administrateur choisit la passerelle active pour chaque type (`/admin/payment-providers`), les passerelles sont des adaptateurs interchangeables (`src/lib/payments/gateways/`, TaraMoney et Maketou fournis), l'identité vient de la session et le prix du catalogue serveur, le crédit est atomique (jamais deux fois), avec webhook, vérification au retour, cron de rattrapage et verrous. Retire ce bloc si le produit est gratuit.
- **Facultatif** : e-mails (Brevo).
- **Déploiement** : `Dockerfile` (build « standalone »), route `/api/health`.

Tout le branding est dans `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ) et `src/lib/pricing.ts` (prix).

## 1. Comprendre (2 minutes)

Écris un `SPEC.md` à partir de ce que dit l'utilisateur, même en désordre :
- **Nom et slug** (minuscules, tirets), promesse en une phrase.
- **Qui l'utilise** : rôles (utilisateur, admin, autre).
- **Données propres au produit** : pour chaque entité, ses champs, ses relations et QUI peut la voir ou la modifier.
- **Écrans et actions** de chaque rôle.
- **Argent** : gratuit, abonnement ou crédits ? Quelles passerelles (aucune, TaraMoney, Maketou, autre : une autre passerelle se branche en ajoutant un adaptateur, voir le README du modèle) ?
- **E-mails**, **langue** de l'interface, **nom de domaine**, **hébergeur** (Docker : Coolify, Fly.io, Railway, un serveur…).

Ce qui manque : prends une valeur par défaut raisonnable et note-la sous « Hypothèses ». Pose au plus 3 questions, seulement si la réponse change vraiment le résultat. Montre un résumé court du `SPEC.md` et demande UN « on y va ? ». Ensuite ne redemande plus rien, sauf avant une action payante ou publique.

## 2. Créer le projet

```bash
bash "<dossier du skill>/scripts/creer-saas.sh" <slug> "<Nom affiché>" <dossier-parent>
```
Le script copie le modèle, remplace le nom, le domaine d'exemple et le nom du paquet, crée `.env.local` depuis `.env.example` et fait un premier commit Git. Place ensuite le `SPEC.md` à la racine du projet. Aucune vraie clé dans Git, jamais de secret affiché dans le chat.

## 3. Adapter et générer

1. Mets à jour `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ, e-mail de support) et `src/lib/pricing.ts` d'après la SPEC. Si le produit est gratuit ou sans paiement, retire les routes et pages de facturation et le fournisseur inutile.
2. **Pour chaque entité de la SPEC** : une migration NEUVE, un schéma `zod`, des routes API CRUD (`src/app/api/<entité>/…`, avec contrôle de l'identité et du propriétaire), des pages liste / création / détail / modification dans `src/app/(dashboard)/<entité>/`, et une ligne dans `site.dashboardNav`.
3. Personnalise la landing page (accroche, fonctionnalités, FAQ) pour qu'elle parle du vrai produit, pas du texte d'exemple. Relis les pages légales : ce sont des textes de départ, pas un avis juridique.

## 4. Migrations : toujours automatiques

- Un fichier NEUF par changement : `supabase/migrations/<AAAAMMJJHHMMSS>_<nom>.sql`. Ne jamais modifier une migration déjà appliquée.
- Rejouables : `create table if not exists`, `add column if not exists`, `drop policy if exists` avant chaque `create policy`, `create or replace function`, `drop trigger if exists`.
- Chaque table : `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (+ trigger), **RLS activée**, politiques tirées de la SPEC (propriétaire, admin), index sur chaque clé étrangère.
- Pour savoir quoi changer, lis l'ÉTAT RÉEL de la base (`supabase db diff` ou `information_schema`), pas ta mémoire ni le dernier fichier : le delta se calcule entre la SPEC et la base.
- Vérifie avant de livrer : `supabase db reset` en local (Docker + CLI Supabase) puis une requête de contrôle ; sinon `supabase db push --dry-run`.

## 5. Connexions

- **Supabase** : crée ou relie le projet (`supabase link`), `supabase db push`, copie URL et clés dans `.env.local`. S'il manque un jeton, demande-le UNE fois sans le répéter ensuite.
- **E-mail, paiement** : branche seulement ce que la SPEC demande ; les clés manquantes restent commentées dans `.env.example`.
- **Déploiement** : construis l'image avec le `Dockerfile`, configure les variables d'environnement, le domaine et un test de `/api/health`. Demande confirmation juste avant de créer une ressource payante ou de rendre le site public.
- **Compte administrateur** : après la première inscription, mets `profiles.is_admin = true` pour le compte du propriétaire (dans Supabase), il n'y a volontairement pas d'écran pour ça.

## 6. Vérifier avant de dire « c'est fait »

1. `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build` : tout doit passer.
2. Lance l'app et teste pour de vrai : inscription, connexion, création / modification / suppression d'une donnée de chaque entité, **déconnexion**, retour sur `/login`, une page privée qui redirige bien. Regarde la console du navigateur.
3. Corrige jusqu'au vert. Si un test échoue, dis-le avec la sortie, sans l'enrober.

## 7. Rendre compte

Réponse courte : ce qui tourne (adresse), les écrans et tables générés, ce qui reste à faire par l'utilisateur (clés, DNS, texte légal), les hypothèses prises.

## Règles

- Jamais de suppression de données ni de ressource payante sans accord. Jamais de secret dans Git ni dans une réponse.
- Une amélioration générale (pas propre à un produit) se reporte aussi dans `template/` de ce skill pour tous les prochains SaaS.
- Autre pile que Next.js + Supabase demandée : dis-le en une phrase, adapte, et note le choix dans la SPEC.
