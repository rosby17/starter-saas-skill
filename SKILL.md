---
name: starter-saas
description: Crée un SaaS complet et opérationnel à partir d'une description (écrite ou dictée) : landing page, authentification avec déconnexion, espace client, administration, tarifs, migrations de base de données générées automatiquement, build vérifié et déploiement. Fait aussi l'AUDIT DE SÉCURITÉ d'un SaaS existant (le sien ou celui de quelqu'un d'autre) et le corrige. Utilise-le quand l'utilisateur dit « starter saas », « crée un SaaS », « nouveau SaaS », décrit une application web à fabriquer, ou demande d'auditer, de vérifier la sécurité ou de corriger les failles d'un SaaS.
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
- **Facultatif** : e-mails (Brevo).
- **Déploiement** : `Dockerfile` (build « standalone »), route `/api/health`.

Tout le branding est dans `src/config/site.ts` (nom, slogan, menus, fonctionnalités, FAQ) et `src/lib/pricing.ts` (prix).

**Deux modes.** Créer un SaaS : étapes 1 à 8 ci-dessous. Auditer un SaaS existant (« audite ce SaaS », « vérifie la sécurité de… », un dossier, un dépôt ou un ZIP reçu) : section « Mode audit de sécurité » en bas.

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
5. **Interface 100 % native du site (OBLIGATOIRE, sans exception)** : aucun élément natif du navigateur. Interdits : `<select>` (et sa liste système), `<input type="date|time|datetime-local|radio|checkbox|color|range">`, `confirm()`, `alert()`, `prompt()`, `window.open`, `<dialog>` brut, infobulles `title`. Utilise les composants du modèle (`src/components/ui` : `Select`, `DatePicker`, `RadioCard`, `Checkbox`, `Switch`, `useConfirm`) et affiche erreurs et succès dans la page. S'il manque un composant (heure, menu déroulant, sélecteur de couleur, fenêtre…), crée-le dans `components/ui` aux couleurs de la charte, avec clavier et accessibilité. `npm run lint` refuse ces éléments : il doit passer sans erreur.
6. Construis la landing page selon la piste choisie (hero, sections, preuves, animations discrètes avec `prefers-reduced-motion`) et pour qu'elle parle du vrai produit, pas du texte d'exemple. Relis les pages légales : ce sont des textes de départ, pas un avis juridique.

## 4. Migrations : toujours automatiques

- Un fichier NEUF par changement : `supabase/migrations/<AAAAMMJJHHMMSS>_<nom>.sql`. Ne jamais modifier une migration déjà appliquée.
- Rejouables : `create table if not exists`, `add column if not exists`, `drop policy if exists` avant chaque `create policy`, `create or replace function`, `drop trigger if exists`.
- Chaque table : `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (+ trigger), **RLS activée**, politiques tirées de la SPEC (propriétaire, admin), index sur chaque clé étrangère.
- Pour savoir quoi changer, lis l'ÉTAT RÉEL de la base (`supabase db diff` ou `information_schema`), pas ta mémoire ni le dernier fichier : le delta se calcule entre la SPEC et la base.
- Vérifie avant de livrer : `supabase db reset` sur la base locale (Docker) puis une requête de contrôle. En ligne, les nouvelles migrations sont appliquées par la prochaine mise en ligne complète.

## 5. Connexions

- **Base de données : Supabase OPEN SOURCE, hébergé par le créateur. JAMAIS de compte supabase.com** (ni gratuit ni payant) : ne lui demande jamais d'en créer un.
  - **En local** : Supabase dans Docker (CLI Supabase). `npm run dev`, puis donne à l'utilisateur le lien `SETUP_URL` : l'assistant `/setup` démarre la base (`supabase start`), écrit ses clés dans `.env.local`, crée les tables, puis crée le compte administrateur. Seul prérequis : Docker Desktop lancé. Tu peux aussi le faire toi-même (`supabase start`, `supabase status -o env`).
  - **En ligne** : `/admin/deploy` installe Supabase sur le serveur Coolify de l'utilisateur (service « Supabase » de Coolify, adresse `api.<domaine>`), y applique les migrations, recopie les administrateurs (même mot de passe), les réglages et les clés de `/admin/keys`.
  - Les requêtes SQL d'installation passent par la route `/pg/` de Supabase avec la clé service (`src/lib/deploy/database.ts`) : même code en local et en ligne.
- **E-mail, paiement** : branche seulement ce que la SPEC demande. Les clés de services (passerelles, Brevo, `CRON_SECRET`) n'ont PAS besoin d'être posées sur le serveur : le propriétaire les colle depuis `/admin/keys` (« Clés et intégrations » : bandeau « clé manquante » + bouton « Renseigner », clé chiffrée en base, active sans redéploiement). Toute nouvelle clé de service ajoutée au SaaS se déclare dans `src/lib/secrets/catalog.ts`. Seules les 3 clés Supabase (et les `NEXT_PUBLIC_*`, figées au build) restent sur le serveur.
- **Mise en ligne** : depuis `/admin/deploy` (sur l'ordinateur, la première fois). L'utilisateur colle dans `/admin/keys` l'adresse + le jeton Coolify (droit « root »), un jeton GitHub, le jeton de son fournisseur de domaine (Hostinger ou Cloudflare), choisit domaine et serveur, clique. Étapes automatiques : DNS (domaine, www, api) → dépôt GitHub PRIVÉ → base Supabase sur le serveur → application Coolify → variables → tâches planifiées → construction → test HTTPS de `/api/health`. Ensuite « Redéployer » marche aussi depuis le site en ligne. Demande confirmation juste avant une action payante (achat de domaine) ou de rendre le site public.
- **Compte administrateur** : créé par l'assistant `/setup` (étape 2). Il n'y a volontairement pas d'autre écran pour devenir administrateur.

## 6. Vérifier avant de dire « c'est fait »

1. `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build` : tout doit passer. (`npm run dev` écrit dans `.next-dev`, le build dans `.next` : ne retire pas ce réglage de `next.config.ts`, sinon un build lancé pendant que le site tourne casse son CSS et son JS.)
2. Lance l'app et teste pour de vrai : inscription, connexion, création / modification / suppression d'une donnée de chaque entité, **déconnexion**, retour sur `/login`, une page privée qui redirige bien. Regarde la console du navigateur.
3. Corrige jusqu'au vert. Si un test échoue, dis-le avec la sortie, sans l'enrober.

## 7. Audit de sécurité (obligatoire avant de livrer)

Lance d'abord le scanner (`python3 "<dossier du skill>/scripts/audit_securite.py" .`) : aucun CRITIQUE ni HAUTE confirmé. Puis passe chaque point ; corrige ce qui échoue, et dis ce qui a été vérifié :
1. **Secrets** : aucun secret dans Git (`git log -p | grep` des motifs de clés, ou `gitleaks detect` s'il est installé), `.env*` ignorés sauf `.env.example`, aucune clé serveur dans un fichier `"use client"` ni dans une variable `NEXT_PUBLIC_*`. Dépôt GitHub créé en **privé** (`gh repo create --private`), jamais public sans demande explicite.
2. **Base** : RLS activée sur CHAQUE table (`select relname from pg_class where relrowsecurity = false` sur le schéma public → vide), politiques propriétaire/admin, aucune politique `using (true)` en écriture ; colonnes sensibles (`is_admin`, crédits, statut de commande) non modifiables par l'utilisateur.
3. **API** : chaque route vérifie la session (`getUser()`) et le propriétaire de la ressource (pas d'identifiant pris du corps de requête pour l'identité : IDOR), entrées validées par `zod`, routes admin derrière `requireAdmin()`, crons derrière `isAuthorizedCron`, webhooks à signature vérifiée en temps constant, prix toujours lus côté serveur.
4. **Navigateur** : en-têtes de `next.config.ts` présents (HSTS, nosniff, CSP, frame-ancestors), aucun `dangerouslySetInnerHTML` sur une donnée utilisateur, e-mails HTML échappés, redirections limitées au site (`site-url.ts`).
5. **Dépendances** : `npm audit --omit=dev` sans vulnérabilité haute ou critique (sinon `npm audit fix` ou mise à jour ciblée).
6. **Abus** : limitation de débit sur connexion, inscription, mot de passe oublié, checkout et formulaires publics.

## 8. Rendre compte

Réponse courte : ce qui tourne (adresse), les écrans et tables générés, ce qui reste à faire par l'utilisateur (clés, DNS, texte légal), les hypothèses prises.

## Mode audit de sécurité

Suis `references/audit-securite.md` en entier. En bref :
1. **Récupère le code** (dossier, `git clone` ou ZIP dans `~/Documents/dev/audits/<nom>`), branche `audit/securite`. Rien d'exécuté à l'aveugle (`--ignore-scripts`), aucune connexion à la base de production, aucun test contre un site en ligne sans l'accord de son propriétaire.
2. **Scanner** : `python3 "<dossier du skill>/scripts/audit_securite.py" <dossier> --sortie <dossier>/SCAN-AUTOMATIQUE.md`. Chaque ligne est un signal à confirmer en lisant le code ; écarte les fausses alertes.
3. **Revue manuelle** des 23 questions de la référence (identité, propriétaire de chaque ressource, rôle admin, RLS, colonnes sensibles, prix, webhooks, crédits atomiques, fichiers, SSRF, redirections, comptes, erreurs, crons, sauvegardes). Les failles graves sont là.
4. **Rapport** `AUDIT-SECURITE.md` : note A à E, 3 risques principaux en langage simple, puis chaque faille avec niveau, fichier:ligne, scénario d'attaque, correction ; et la liste de ce qui a été vérifié sans problème. Secrets : dire où, jamais les afficher ni ouvrir un coffre d'identifiants.
5. Montre le résumé et demande UN accord, puis **corrige** dans l'ordre CRITIQUE → HAUTE → MOYENNE, un commit par correction, migrations neuves pour la base. Revérifie (`tsc`, lint, build, scanner relancé) et mets le rapport à jour : note avant / après, ce que le propriétaire doit faire lui-même (révoquer une clé, nettoyer l'historique Git…).

Le même audit s'applique aux SaaS créés avec ce skill (étape 7).

## Règles

- Jamais de suppression de données ni de ressource payante sans accord. Jamais de secret dans Git ni dans une réponse. Dépôts toujours créés en privé.
- Une amélioration générale (pas propre à un produit) se reporte aussi dans `template/` de ce skill pour tous les prochains SaaS.
- Autre pile que Next.js + Supabase demandée : dis-le en une phrase, adapte, et note le choix dans la SPEC.
