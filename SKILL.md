---
name: starter-saas
description: Crée un SaaS complet et opérationnel à partir d'une description (écrite ou dictée) : landing page, authentification avec déconnexion, espace client, administration, tarifs, migrations de base de données générées automatiquement, build vérifié et déploiement. Fait aussi l'AUDIT complet d'un SaaS existant (le sien ou celui de quelqu'un d'autre) sur 11 domaines : authentification, droits d'accès, paiements, API, sécurité, robustesse (pannes, sauvegardes), rentabilité (marges, coûts de l'IA, prix, point mort), légal et données personnelles, design et accessibilité, performance et référencement, qualité du code ; rapport par domaine dans le chat, puis corrections. Sait aussi SIMPLIFIER un produit que les testeurs trouvent « trop compliqué » (accueil épuré, mode Simple / Avancé, assistant en 3 écrans, « Premiers pas »), faire exporter et importer un espace de travail en un fichier, traduire dans 12 langues, et auditer une pile qui n'est pas Next.js. Utilise-le quand l'utilisateur dit « starter saas », « crée un SaaS », « nouveau SaaS », décrit une application web à fabriquer, ou demande d'auditer un SaaS, d'en vérifier la sécurité, la rentabilité ou la solidité, ou d'en corriger les failles, ou dit « c'est trop compliqué », « simplifie l'interface », « exporter / importer », « traduis dans toutes les langues ».
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
- **Paiement orchestré** (même flux pour tous tes SaaS) : le client choisit un TYPE de paiement (mobile money, carte, PayPal), l'administrateur choisit la passerelle active pour chaque type (`/admin/payment-providers`), les passerelles sont des adaptateurs interchangeables (`src/lib/payments/gateways/`, Maketou, Tara Money, Warappay (mobile money, carte, PayPal), GeniusPay, K-Pay (carte) et Binance Pay manuel fournis ; montants convertis en FCFA d'après les taux ; webhooks signés dans `src/app/api/payment/webhook/<passerelle>/` ; les clés sont des variables d'environnement, voir `.env.example`), l'identité vient de la session et le prix du catalogue serveur, le crédit est atomique (jamais deux fois), avec webhook, vérification au retour, cron de rattrapage et verrous. **Facturation et administration** : historique des paiements et factures imprimables côté client (`/billing-history`), commandes côté admin (`/admin/orders` : vérifier, marquer payée, abandonner), ajustement manuel de crédits, journal d'audit, crons `update-rates` (taux de change) et `expire-credits` (crédits à durée de validité, `validityDays` dans `pricing.ts`). Vendeur des factures : `site.company`. Retire ce bloc si le produit est gratuit.
- **Interface simple ou avancée** : `ViewModeProvider` / `ViewModeToggle` / `useViewMode` (`components/ViewMode.tsx`, interrupteur « Simple | Avancé » dans l'en-tête, Simple par défaut), menu en **groupes pliables** (`group` et `advanced` dans `site.dashboardNav`), `GettingStarted` (« Premiers pas » qui se coche tout seul). Méthode complète : `references/simplicite-interface.md`.
- **Facultatif** : e-mails (Brevo).
- **Déploiement** : `Dockerfile` (build « standalone »), route `/api/health`.
- **Supervision des erreurs** : journal `error_logs` (migration 0012, référence ERR-… donnée au client), gravité « qui doit agir ? » (rouge = notre bug seulement ; panne fournisseur marquée `error_code: 'provider_unavailable'` = jamais critique), page `/admin/sante` (une phrase d'état, 5 cartes maximum, fenêtre 24 h), résolution automatique à 24 h et purge à 30 jours, bannière « services ralentis » (`/api/system-status`), `fetchWithConnectRetry` (`src/lib/http/fetch-retry.ts`, ne rejoue que les connexions jamais établies). Toute route qui appelle un fournisseur externe renvoie `error_code: 'provider_unavailable'` quand il ne répond pas, après remboursement. Détails : `references/supervision-exploitation.md`.
- **Crédits insuffisants** : toute route qui débite lève `InsufficientCreditsError` (`lib/credits/balance.ts`) et répond `creditsErrorResponse(error)` (403 + `error_code: 'insufficient_credits'`) ; `InsufficientCreditsGate` (dans le layout connecté) ouvre alors partout la fenêtre « Recharger mes crédits », sans câblage page par page.
- **Cookies (RGPD)** : `CookieConsentBanner` à la racine + `CookieSettingsLink` dans le pied de page ; `getCookieConsent()` : ne charger statistiques et publicité qu'après « accepté ». `NEXT_PUBLIC_COOKIE_DOMAIN` partage le choix entre sous-domaines.
- **Ressources serveur** (`/admin/server`) : processeur, mémoire, disque, historique 24 h (migration 0013), état jugé sur la MOYENNE des 5 dernières minutes (un pic de build n'est pas une alerte) ; collecteur hôte optionnel `ops/vps-metrics-agent.py` + `vps-metrics.service`.
- **Exploitation** : `ops/nettoyage-serveur.sh` + `.cron` (nettoyage hebdomadaire du serveur, sans toucher aux volumes). Journal d'erreurs, bannière de panne fournisseur, nouveaux essais prudents et erreurs déjà commises en production : `references/supervision-exploitation.md` (à appliquer à chaque SaaS qui a un fournisseur externe).

Tout le branding est dans `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ) et `src/lib/pricing.ts` (prix).

**Trois modes.** Créer un SaaS : étapes 1 à 8 ci-dessous. Auditer un SaaS existant (« audite ce SaaS », « vérifie la sécurité / la rentabilité / la solidité de… », un dossier, un dépôt ou un ZIP reçu) : section « Mode audit » en bas. Simplifier un produit trop compliqué ou lui ajouter export / import / traductions : section « Savoir-faire appris sur des produits réels » juste avant le mode audit.

## 1. Comprendre (2 minutes)

Guide d'utilisation complet pour l'utilisateur : `README.md` de ce skill ; questionnaire à remplir : `BRIEF-MODELE.md`.

Écris un `SPEC.md` à partir de ce que dit l'utilisateur, même en désordre :
- **Nom et slug** (minuscules, tirets), promesse en une phrase.
- **Qui l'utilise** : rôles (utilisateur, admin, autre).
- **Données propres au produit** : pour chaque entité, ses champs, ses relations et QUI peut la voir ou la modifier.
- **Écrans et actions** de chaque rôle.
- **Argent** : gratuit, abonnement ou crédits ? Quelles passerelles (aucune, TaraMoney, Maketou, autre : une autre passerelle se branche en ajoutant un adaptateur, voir le README du modèle) ?
- **E-mails**, **langue** de l'interface, **nom de domaine**, **hébergeur** (Docker : Coolify, Fly.io, Railway, un serveur…).
- **Charte graphique** (section « Charte » du SPEC, TOUJOURS remplie) : ambiance, couleur principale (boutons, texte blanc dessus), couleur secondaire, police Google Fonts, logo (chemin du fichier), icône d'onglet, ton des textes (tu/vous). Si l'utilisateur n'en donne pas ou dit « propose-moi », propose 3 palettes cohérentes avec son métier (2 couleurs hex + police + ambiance en une ligne chacune) et fais-le choisir : c'est l'une des 3 questions autorisées.

- **Direction artistique** (section du SPEC, TOUJOURS remplie, voir `references/direction-artistique.md`) : d'abord le raisonnement (pour qui, ressenti visé, niveau de prix, ce qui vend le produit, contraintes, style en 3 mots), PUIS la recherche d'inspiration sur recent.design filtrée par ce raisonnement, et 3 pistes de landing page aux partis pris différents (lien, ce qu'on emprunte, pourquoi ça sert ce produit). Si l'utilisateur a cité des sites qu'il aime, pars d'eux.

L'utilisateur peut coller le questionnaire `BRIEF-MODELE.md` de ce skill rempli : s'il demande par où commencer, donne-le-lui.

Ce qui manque : prends une valeur par défaut raisonnable et note-la sous « Hypothèses ». Pose au plus 3 questions, seulement si la réponse change vraiment le résultat. Montre un résumé court du `SPEC.md` (avec les 3 pistes de design à choisir ou mélanger) et demande UN « on y va ? ». Ensuite ne redemande plus rien, sauf avant une action payante ou publique.

## 2. Créer le projet

```bash
bash "<dossier du skill>/scripts/creer-saas.sh" <slug> "<Nom affiché>" <dossier-parent>
```
Le script copie le modèle, remplace le nom, le domaine d'exemple et le nom du paquet, crée `.env.local` depuis `.env.example`, prépare la base locale (`supabase/config.toml` avec des ports propres au projet : plusieurs SaaS cohabitent sur le même ordinateur) et fait un premier commit Git. Il affiche `SETUP_URL` : le lien de l'assistant d'installation. Place ensuite le `SPEC.md` à la racine du projet. Aucune vraie clé dans Git, jamais de secret affiché dans le chat.

## 3. Adapter et générer

1. Mets à jour `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ, e-mail de support) et `src/lib/pricing.ts` d'après la SPEC. Si le produit est gratuit ou sans paiement, retire les routes et pages de facturation et le fournisseur inutile.
2. **Pour chaque entité de la SPEC** : une migration NEUVE, un schéma `zod`, des routes API CRUD (`src/app/api/<entité>/…`, avec contrôle de l'identité et du propriétaire), des pages liste / création / détail / modification dans `src/app/(dashboard)/<entité>/`, et une ligne dans `site.dashboardNav`.
3. **Adapte la piste de design choisie** (`references/direction-artistique.md`, point 4). Jamais de design automatique « bête » : chaque choix (structure, typographie, animation) se justifie par le produit et son public. On reprend une structure et une intention, jamais les textes, images ou logos d'un autre site ; la charte du produit prime. Revérifie sur recent.design (`?category=motion`, `?category=interface`) si une section ou une animation manque d'idée.
4. **Applique la charte** : couleurs et police dans le bloc `@theme` « CHARTE GRAPHIQUE » de `src/app/globals.css` (`--color-brand`, `--color-brand-hover`, `--color-accent`, `--font-sans`) ; police Google chargée avec `next/font/google` dans `src/app/layout.tsx` et reliée à `--font-sans` ; logo copié dans `public/` + `site.logo` ; icône en `src/app/icon.png`. Vérifie le contraste blanc sur `--color-brand` (≥ 4,5:1, sinon fonce la couleur et dis-le). N'écris jamais de couleur en dur dans un composant : `bg-brand`, `text-brand`, `bg-accent`.
5. **Interface 100 % native du site (OBLIGATOIRE, sans exception)** : aucun élément natif du navigateur. Interdits : `<select>` (et sa liste système), `<input type="date|time|datetime-local|radio|checkbox|color|range">`, `confirm()`, `alert()`, `prompt()`, `window.open`, `<dialog>` brut, infobulles `title`. Utilise les composants du modèle (`src/components/ui` : `Select`, `DatePicker`, `RadioCard`, `Checkbox`, `Switch`, `useConfirm`, `PasswordInput` avec l'œil pour TOUT mot de passe) et affiche erreurs et succès dans la page. S'il manque un composant (heure, menu déroulant, sélecteur de couleur, fenêtre…), crée-le dans `components/ui` aux couleurs de la charte, avec clavier et accessibilité. `npm run lint` refuse ces éléments : il doit passer sans erreur.
6. Construis la landing page selon la piste choisie (hero, sections, preuves, animations discrètes avec `prefers-reduced-motion`) et pour qu'elle parle du vrai produit, pas du texte d'exemple. Relis les pages légales : ce sont des textes de départ, pas un avis juridique.

## 4. Migrations : toujours automatiques

- Un fichier NEUF par changement : `supabase/migrations/<AAAAMMJJHHMMSS>_<nom>.sql`. Ne jamais modifier une migration déjà appliquée.
- Rejouables : `create table if not exists`, `add column if not exists`, `drop policy if exists` avant chaque `create policy`, `create or replace function`, `drop trigger if exists`.
- Chaque table : `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (+ trigger), **RLS activée**, politiques tirées de la SPEC (propriétaire, admin), index sur chaque clé étrangère.
- Pour savoir quoi changer, lis l'ÉTAT RÉEL de la base (`supabase db diff` ou `information_schema`), pas ta mémoire ni le dernier fichier : le delta se calcule entre la SPEC et la base.
- Vérifie avant de livrer : `supabase db reset` sur la base locale (Docker) puis une requête de contrôle. En ligne, les nouvelles migrations sont appliquées par la prochaine mise en ligne complète.
- **Teste-les pour de vrai** : `bash "<dossier du skill>/scripts/tester-migrations.sh" <projet>` lance une base Supabase jetable (Docker), joue chaque migration DEUX fois (rejouable), puis les tests `supabase/tests/*.sql`, et efface la base. Pour chaque règle sensible de ton produit (droits, crédit, quota), ajoute un test dans `supabase/tests/` avec des `assert` : le modèle en fournit un pour la facturation (`billing.test.sql`).

## 5. Connexions

- **Base de données : Supabase OPEN SOURCE, hébergé par le créateur. JAMAIS de compte supabase.com** (ni gratuit ni payant) : ne lui demande jamais d'en créer un.
  - **En local (mode « Local » : test sur l’ordinateur ; jamais pour déployer sur un serveur)** : Supabase dans Docker (CLI Supabase). `npm run dev`, puis donne à l'utilisateur le lien `SETUP_URL` : l'assistant `/setup` démarre la base (`supabase start`), écrit ses clés dans `.env.local`, crée les tables, puis crée le compte administrateur. Seul prérequis : Docker Desktop lancé. Tu peux aussi le faire toi-même (`supabase start`, `supabase status -o env`).
  - **En ligne** : `/admin/deploy` installe Supabase sur le serveur Coolify de l'utilisateur (service « Supabase » de Coolify, adresse `api.<domaine>`), y applique les migrations, recopie les administrateurs (même mot de passe), les réglages et les clés de `/admin/keys`.
  - Les requêtes SQL d'installation passent par la route `/pg/` de Supabase avec la clé service (`src/lib/deploy/database.ts`) : même code en local et en ligne.
- **E-mail, paiement** : branche seulement ce que la SPEC demande. Les clés de services (passerelles, Brevo, `CRON_SECRET`) n'ont PAS besoin d'être posées sur le serveur : le propriétaire les colle depuis `/admin/keys` (« Clés et intégrations » : bandeau « clé manquante » + bouton « Renseigner », clé chiffrée en base, active sans redéploiement). Toute nouvelle clé de service ajoutée au SaaS se déclare dans `src/lib/secrets/catalog.ts`. Seules les 3 clés Supabase (et les `NEXT_PUBLIC_*`, figées au build) restent sur le serveur.
- **Mise en ligne** : depuis `/admin/deploy` (sur l'ordinateur, la première fois). L'utilisateur colle dans `/admin/keys` l'adresse + le jeton Coolify (droit « root »), un jeton GitHub, le jeton de son fournisseur de domaine (Hostinger ou Cloudflare), choisit domaine et serveur, clique. Étapes automatiques : DNS (domaine, www, api) → dépôt GitHub PRIVÉ → base Supabase sur le serveur → application Coolify → variables → tâches planifiées → construction → test HTTPS de `/api/health`. Ensuite « Redéployer » marche aussi depuis le site en ligne. Demande confirmation juste avant une action payante (achat de domaine) ou de rendre le site public.
- **DEUX MODES AU CHOIX, à demander dès le début (une seule question) : « Tu veux tester sur ton ordinateur, ou déployer directement sur ton serveur ? »**
  - **Local (apprenant, simple test : pas encore de domaine, de base ni de serveur)** : Supabase dans Docker + `npm run dev` + assistant `/setup` (voir plus haut). C'est tout ; ne parle ni de Coolify ni de domaine. Quand l'apprenant aura un serveur, il passera au mode serveur.
  - **Serveur (pro qui veut démarrer vite)** : AUCUN lancement local (pas de `npm run dev`, pas de Docker, pas de `/setup` local). Si `~/.starter-saas/serveur.json` existe (profil serveur déjà enregistré : Coolify, jetons, DNS), le mode serveur est proposé par défaut et il ne manque que le domaine (le script propose `<nom>.<domaine de base>`). Sinon, la première fois, il faut : adresse Coolify + jeton API (droit « root »), jeton GitHub (case « repo »), fournisseur DNS (Hostinger/Cloudflare + jeton, ou « à la main »), domaine. Après la construction (`npm run build` et `npm run lint` verts), lance `npm run deployer` (`scripts/deployer.ts`) : il demande ces valeurs lui-même (saisie masquée ; ne les écris jamais dans le chat), les garde dans `~/.starter-saas/serveur.json` pour tous les SaaS suivants, et fait tout : DNS → dépôt GitHub privé → base Supabase sur le serveur + migrations → application Coolify + variables + tâches programmées → construction → test HTTPS de `/api/health`. Rejouable : relancer = mise à jour. À la fin, il affiche le lien `https://<domaine>/setup?token=…` du SITE EN LIGNE : l'utilisateur y crée son compte administrateur, puis règle ses clés (paiement, e-mail) dans `/admin/keys` sur le site en ligne. Ne dis « déployé » que si le domaine répond depuis le serveur ; sinon dis précisément ce qui manque (clé, DNS…).
  - Quand l'utilisateur dit « jusqu'au déploiement » / « mets en ligne » et que le mode n'est pas évident, c'est le mode serveur : ne t'arrête jamais au local.
- **Compte administrateur** : créé par l'assistant `/setup` (étape 2). Il n'y a volontairement pas d'autre écran pour devenir administrateur.

## 6. Vérifier avant de dire « c'est fait »

1. `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build` : tout doit passer. (`npm run dev` écrit dans `.next-dev`, le build dans `.next` : ne retire pas ce réglage de `next.config.ts`, sinon un build lancé pendant que le site tourne casse son CSS et son JS.)
2. Lance l'app et teste pour de vrai : inscription, connexion, création / modification / suppression d'une donnée de chaque entité, **déconnexion**, retour sur `/login`, une page privée qui redirige bien. Regarde la console du navigateur.
3. Corrige jusqu'au vert. Si un test échoue, dis-le avec la sortie, sans l'enrober.

## 7. Audit complet en 11 domaines (obligatoire avant de livrer)

Lance `python3 "<dossier du skill>/scripts/audit_complet.py" . --sortie AUDIT-COMPLET.md` : il passe les 4 scanners et range tout en 11 domaines (authentification, accès, paiements, API, sécurité technique, robustesse, rentabilité, légal, design et accessibilité, performance et référencement, qualité du code). Aucun CRITIQUE ni HAUTE confirmé ; seuls les prix d'exemple restent tant que l'utilisateur ne les a pas donnés. Passe aussi les cases manuelles de `references/checklist-saas.md`, en particulier le test à deux comptes clients. Les points détaillés ci-dessous restent la référence :
1. **Secrets** : aucun secret dans Git (`git log -p | grep` des motifs de clés, ou `gitleaks detect` s'il est installé), `.env*` ignorés sauf `.env.example`, aucune clé serveur dans un fichier `"use client"` ni dans une variable `NEXT_PUBLIC_*`. Dépôt GitHub créé en **privé** (`gh repo create --private`), jamais public sans demande explicite.
2. **Base** : RLS activée sur CHAQUE table (`select relname from pg_class where relrowsecurity = false` sur le schéma public → vide), politiques propriétaire/admin, aucune politique `using (true)` en écriture ; colonnes sensibles (`is_admin`, crédits, statut de commande) non modifiables par l'utilisateur.
3. **API** : chaque route vérifie la session (`getUser()`) et le propriétaire de la ressource (pas d'identifiant pris du corps de requête pour l'identité : IDOR), entrées validées par `zod`, routes admin derrière `requireAdmin()`, crons derrière `isAuthorizedCron`, webhooks à signature vérifiée en temps constant, prix toujours lus côté serveur.
4. **Navigateur** : en-têtes de `next.config.ts` présents (HSTS, nosniff, CSP, frame-ancestors), aucun `dangerouslySetInnerHTML` sur une donnée utilisateur, e-mails HTML échappés, redirections limitées au site (`site-url.ts`).
5. **Dépendances** : `npm audit --omit=dev` sans vulnérabilité haute ou critique (sinon `npm audit fix` ou mise à jour ciblée).
6. **Abus** : limitation de débit sur connexion, inscription, mot de passe oublié, checkout et formulaires publics.

Puis la rentabilité et la robustesse :
- `python3 "<dossier du skill>/scripts/audit_rentabilite.py" .` : aucun CRITIQUE ni HAUTE. Les prix d'exemple de `pricing.ts` (marqués TODO) sont remplacés par les vrais, calculés avec `scripts/calcul_rentabilite.py` à partir des coûts du produit. Toute fonction payante (IA, SMS…) débite des crédits avec `debitCredits()` AVANT l'appel et plafonne la longueur (max_tokens).
- `python3 "<dossier du skill>/scripts/audit_robustesse.py" .` : aucun CRITIQUE, HAUTE ni MOYENNE ; chaque nouvel appel extérieur a un délai maximal, chaque écriture lit son erreur, chaque nouvelle clé étrangère a son index, chaque liste qui grandit est paginée. Restent en « À VÉRIFIER » les tests, l'intégration continue et les sauvegardes : dis à l'utilisateur de régler les sauvegardes de la base dans Coolify (Backups du service, vers un stockage S3).

## 8. Rendre compte

Réponse courte : ce qui tourne (adresse), les écrans et tables générés, ce qui reste à faire par l'utilisateur (clés, DNS, texte légal), les hypothèses prises.

## Savoir-faire appris sur des produits réels (KappGen, 05-06/10/2026)

Ces fiches viennent d'un vrai produit (logiciel + site, 12 langues, plusieurs sessions Claude en parallèle). Les lire AVANT de refaire la même chose :
- **« Trop de boutons, on ne comprend pas »** → `references/simplicite-interface.md` : 4 principes, 7 gestes (accueil à 3 choses, états en 3 mots, interrupteur Simple | Avancé, menu en groupes pliables — jamais d'entrée cachée —, assistant en 3 écrans, « Premiers pas », chaque page en deux vues), méthode phase par phase, pièges. Briques prêtes dans `template/` (`ViewMode.tsx`, `GettingStarted.tsx`, `DashboardShell.tsx`).
- **« Je veux partager mon espace de travail avec quelqu'un »** → `references/transfert-export-import.md` : un zip, ce qui part et ne part jamais, import sûr (chemins, tailles, tout ou rien, nom unique, licence, routines refaites), tests.
- **Interface en plusieurs langues** → `references/traductions.md` : source + repli anglais, règle « chaque texte traduit en anglais dans le même changement », outil de lot avec contrôle des `{n}`, pièges des dictionnaires.
- **Plusieurs sessions sur le même dépôt, livraison, essais sans abîmer les vraies données** → `references/travail-parallele-livraison.md`.
- **Auditer un produit en Python / JavaScript maison** → `references/audit-autre-pile.md` (les scanners reconnaissent maintenant cette pile ; revue à la main de ce qu'ils ne voient pas).
- **Page des clés / intégrations, choisir un utilisateur dans l'admin** → `references/integrations-et-cles.md` : tuiles avec logos officiels (jamais d'initiale), état, filtres, saisie en fenêtre, lien dans le menu du profil, recherche pendant la frappe, piège des types de clé (Brevo `xkeysib-` / `xsmtpsib-`).
- **Le site sur téléphone** → `references/mobile-navigation.md` : ☰ avec les noms, ← partout, « ← Mon compte » sur les pages autonomes, rien au-delà de 375 px, langue en menu déroulant.
- **E-mails qui n'arrivent pas, deux étapes** → `references/emails-et-deux-etapes.md` : envoi qui attend la réponse et montre la vraie erreur, journal, « exemple de chaque e-mail », pas de secret dans un sujet, tests sans vrai fournisseur ; deux étapes par e-mail ou application + codes de secours.
- **Statistiques, amélioration automatique, rapport par e-mail, notifications téléphone** → `references/suivi-a-distance-et-statistiques.md` (chiffres honnêtes, boucle vers l'IA, Web Push sans contenu signé VAPID).
- **Logiciel installé chez le client (mises à jour, fenêtre, installateurs)** → `references/logiciel-installe-mises-a-jour.md`.
- **Avant le lancement ou une campagne : la pub dit-elle vrai ?** → `references/promesses-marketing.md`.

## Mode audit

Le SaaS à auditer (le sien, ou celui qu'on lui envoie) est jugé sur la grille UNIQUE des **11 domaines d'un bon SaaS** (`references/checklist-saas.md`) : 1 authentification et comptes, 2 droits d'accès et données des clients, 3 paiements et facturation, 4 API et intégrations, 5 sécurité technique, 6 robustesse et exploitation, 7 rentabilité, 8 données personnelles et légal, 9 expérience, design et accessibilité, 10 performance et référencement, 11 qualité du code et évolutivité. « Audite ce SaaS » = les 11 domaines. « Vérifie la sécurité / la rentabilité / la solidité » = la rubrique demandée, avec sa méthode détaillée ci-dessous.

**Première passe** : `python3 "<dossier du skill>/scripts/audit_complet.py" <dossier> --sortie <dossier>/AUDIT-COMPLET.md` (4 scanners : sécurité, rentabilité, robustesse, produit). Puis la revue manuelle de chaque domaine (checklist + questions des méthodes détaillées).

**Rapport dans le chat (OBLIGATOIRE, toujours dans cet ordre)** :
1. Le tableau des 11 domaines (état ✓ / ⚠ / ✗ / ?, nombre de failles par niveau) et la note sur 100.
2. Les urgences (CRITIQUE puis HAUTE) : pour chacune, le risque concret en une phrase (« n'importe qui peut lire les factures des autres clients ») et la correction.
3. Domaine par domaine (Authentification, Accès, Paiement, API, …) : chaque faille CONFIRMÉE avec niveau, `fichier:ligne` et correction ; les fausses alertes écartées en une ligne.
4. Ce qui n'a pas pu être vérifié (et pourquoi), ce que le propriétaire doit faire lui-même, puis UNE question : « je corrige ? ».
Le détail (preuves, scénarios, toutes les cases manuelles) va dans `AUDIT-COMPLET.md`.

Méthodes détaillées par rubrique :

| Rubrique | Méthode | Scanner | Rapport |
|---|---|---|---|
| Sécurité | `references/audit-securite.md` | `scripts/audit_securite.py` | `AUDIT-SECURITE.md` |
| Rentabilité | `references/audit-rentabilite.md` | `scripts/audit_rentabilite.py` + `scripts/calcul_rentabilite.py` | `AUDIT-RENTABILITE.md` |
| Robustesse | `references/audit-robustesse.md` | `scripts/audit_robustesse.py` | `AUDIT-ROBUSTESSE.md` |
| Supervision et exploitation | `references/supervision-exploitation.md` | (revue manuelle, section 7) | dans `AUDIT-ROBUSTESSE.md` |
| Pile autre que Next.js (Python, JavaScript maison…) | `references/audit-autre-pile.md` | les mêmes (ils reconnaissent la pile) | `AUDIT-COMPLET.md` |

En bref :
1. **Récupère le code** (dossier, `git clone` ou ZIP dans `~/Documents/dev/audits/<nom>`). Rien d'exécuté à l'aveugle (`--ignore-scripts`), aucune connexion à la base de production sans accord (et alors en lecture seule), aucun test contre un site en ligne sans l'accord de son propriétaire.
2. **Scanners** : `python3 "<dossier du skill>/scripts/<scanner>" <dossier> --sortie <dossier>/SCAN-<RUBRIQUE>.md`. Chaque ligne est un signal à confirmer en lisant le code ; écarte les fausses alertes et dis pourquoi.
3. **Rentabilité : les chiffres** : demande au propriétaire ses coûts (serveur, IA, SMS, passerelle) et ses volumes, remplis `chiffres.json` (`calcul_rentabilite.py --modele`), puis calcule marges, point mort et prix minimum. Prix des fournisseurs lus sur leur page le jour même, jamais de mémoire.
4. **Revue manuelle** des questions de chaque méthode (23 sécurité, 18 rentabilité, 22 robustesse). Les failles graves, les pertes d'argent et les pannes sont là.
5. **Rapports** : chacun commence par une note A à E et les 3 points principaux en langage simple, puis chaque point avec niveau, fichier:ligne, preuve (scénario d'attaque, coût en argent, scénario de panne) et correction ; et ce qui a été vérifié sans problème. Secrets : dire où, jamais les afficher.
6. Montre un résumé (les trois notes, les 3 urgences toutes rubriques confondues) et demande UN accord, puis **corrige** sur `audit/<rubrique>`, CRITIQUE → HAUTE → MOYENNE, un commit par correction, migrations neuves. Les prix et les offres ne changent qu'avec l'accord explicite du propriétaire. Revérifie (`tsc`, lint, build, scanners relancés, calcul refait) et donne les notes avant / après, plus ce que le propriétaire doit faire lui-même (révoquer une clé, régler les sauvegardes, changer un prix).

Les scanners se testent : `python3 tests/test_audit.py`, `python3 tests/test_rentabilite_robustesse.py`, `python3 tests/test_produit.py` (faux SaaS pleins de défauts connus : tout doit être trouvé, et rien sur leur version corrigée) et `python3 tests/test_autre_pile.py` (projet Python + JavaScript maison sain : aucune fausse alerte). **Une fausse alerte sur un vrai produit se corrige dans le scanner ET se note dans ce dernier test** : le kit apprend de chaque audit. Les mêmes audits s'appliquent aux SaaS créés avec ce skill (étape 7).

## Règles

- Jamais de suppression de données ni de ressource payante sans accord. Jamais de secret dans Git ni dans une réponse. Dépôts toujours créés en privé.
- Toute leçon d'exploitation tirée d'un incident (panne, alerte inutile, charge serveur) s'ajoute à `references/supervision-exploitation.md`, et son script réutilisable à `template/ops/`.
- Une amélioration générale (pas propre à un produit) se reporte aussi dans `template/` de ce skill pour tous les prochains SaaS.
- Autre pile que Next.js + Supabase demandée : dis-le en une phrase, adapte, et note le choix dans la SPEC.
- **Double sens** : le kit transmet à chaque produit ce qu'il a appris des autres (modèle, fiches, scanners), ET apprend de chaque produit sur lequel il travaille (nouvelle fiche dans `references/`, brique dans `template/`, règle de scanner avec son test). En fin de chantier sur un produit réel, demande-toi : « qu'ai-je appris qui servira au prochain SaaS ? » et ajoute-le ici avant de dire « terminé ».
- **On ne cache jamais une fonction pour simplifier un écran : on la range** (groupe pliable, « Personnaliser », mode Avancé). Le défaut est le mode Simple.
- Tout nouveau texte visible est traduit dans TOUTES les langues proposées par le produit (au minimum l'anglais dans le même changement).
- **Aucun contrôle natif du navigateur** : lecteurs audio et vidéo, menus déroulants (`select`), cases à cocher et boutons radio, champs de fichier, curseurs (`range`), champs date/heure, barres de défilement et infobulles sont toujours redessinés aux couleurs de la charte du SaaS (variables de `globals.css`, en clair et en sombre). Avant de livrer, chercher `<audio`, `<video controls`, `<select`, `type="checkbox|radio|file|range|date|time"` et les remplacer par des composants maison réutilisables (`src/components/ui/`).
