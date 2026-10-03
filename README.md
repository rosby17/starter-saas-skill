# starter-saas : ton SaaS en ligne, à partir d'une simple description

Un skill pour [Claude Code](https://claude.com/claude-code). Tu décris ton produit (par écrit ou à la voix), Claude fabrique le SaaS complet : site vitrine, connexion, espace client, administration, tarifs et paiements, base de données, contrôle de sécurité, puis mise en ligne.
Tout ce qui se répète d'un SaaS à l'autre est déjà prêt : tu ne parles que de ce qui rend le tien unique.

---

## Sommaire
1. [Ce que tu obtiens](#1-ce-que-tu-obtiens)
2. [Avant de commencer](#2-avant-de-commencer-10-minutes-une-seule-fois)
3. [Installer le skill](#3-installer-le-skill)
4. [Créer ton SaaS pas à pas](#4-créer-ton-saas-pas-à-pas)
5. [Ta charte graphique](#5-ta-charte-graphique)
6. [Après la création : 5 réglages](#6-après-la-création--5-réglages)
7. [Mettre en ligne](#7-mettre-en-ligne)
8. [Sécurité](#8-sécurité)
9. [Auditer un SaaS : les 11 domaines](#9-auditer-un-saas-le-tien-ou-celui-dun-client)
10. [Faire évoluer ton SaaS](#10-faire-évoluer-ton-saas)
11. [Problèmes fréquents](#11-problèmes-fréquents)

---

## 1. Ce que tu obtiens

| Partie | Contenu |
|---|---|
| Site public | Accueil, fonctionnalités, tarifs, FAQ, pages légales, référencement Google (sitemap, robots), pages 404 et erreur |
| Comptes | Inscription, connexion, mot de passe oublié, déconnexion, pages privées protégées |
| Espace client | Tableau de bord, tes fonctionnalités à toi, abonnement, historique des paiements et factures, aide (tickets), mon compte |
| Administration | Vue d'ensemble, utilisateurs, commandes, moyens de paiement, **clés et intégrations**, support, avis, annonces, mode maintenance, journal d'audit |
| Paiements | Mobile Money, carte, PayPal, crypto : Maketou, Tara Money, Warappay, GeniusPay, K-Pay, Binance Pay (manuel). Tu choisis la passerelle active depuis l'admin |
| Technique | Next.js 15, Supabase, Tailwind, Docker. Base de données par migrations automatiques, sécurité ligne par ligne sur chaque table |

## 2. Avant de commencer (10 minutes, une seule fois)

**Sur ton ordinateur :**
- [Claude Code](https://claude.com/claude-code) (application de bureau ou terminal)
- [Node.js 20 ou plus](https://nodejs.org) et [Git](https://git-scm.com)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) : ta base de données tourne dedans, sur ton ordinateur (lance-le avant de créer un SaaS)
- Le CLI Supabase (gratuit, open source) : `brew install supabase/tap/supabase` sur Mac. Sans lui, Claude utilise `npx supabase`, plus lent.

**Pas de compte Supabase à créer.** Ta base de données est le Supabase **open source**, installé chez toi : dans Docker sur ton ordinateur, puis sur TON serveur à la mise en ligne. Tes données restent chez toi, sans abonnement.

**Comptes :**
- [GitHub](https://github.com) : pour garder ton code (toujours en dépôt **privé**)
- [Brevo](https://brevo.com) si tu veux envoyer des e-mails
- Un compte marchand chez ta passerelle de paiement, si ton SaaS est payant
- Un serveur avec [Coolify](https://coolify.io) (un VPS de 4 Go de mémoire minimum : il fait tourner ton site ET sa base)
- Un nom de domaine chez Hostinger ou Cloudflare (ou ailleurs, en réglant le DNS toi-même)

Tu n'as pas toutes les clés ? Pas grave : le SaaS démarre sans elles, et tu pourras les coller plus tard **depuis ton admin**, sans toucher au serveur.

## 3. Installer le skill

Le dépôt est privé : tu dois avoir reçu une invitation GitHub (accepte-la dans l'e-mail reçu ou sur github.com/notifications). Ensuite, dans un terminal :

```bash
git clone https://github.com/rosby17/starter-saas-skill.git ~/.claude/skills/starter-saas
```

Git te demande de te connecter à GitHub la première fois. Le plus simple est d'installer [GitHub CLI](https://cli.github.com) puis de lancer `gh auth login`.

Vérifie : dans Claude Code, tape `/starter-saas`. Si le skill apparaît, c'est bon.

## 4. Créer ton SaaS pas à pas

1. **Prépare ton brief.** Ouvre [BRIEF-MODELE.md](BRIEF-MODELE.md) et remplis ce que tu sais : produit, données, prix, **charte graphique**, domaine. 10 minutes suffisent, et les cases vides sont permises.
2. **Lance Claude Code** dans le dossier où ranger tes projets (par exemple `Documents/dev`).
3. **Colle ton brief** avec « starter saas : » devant. Tu peux aussi simplement parler :
   > starter saas : une application pour que les coiffeurs gèrent leurs rendez-vous et envoient des rappels SMS. Abonnement à 5 000 FCFA par mois, paiement Mobile Money. Couleurs violet et doré, police Poppins, ton chaleureux.
4. **Réponds aux questions** (3 au maximum), y compris celles sur la charte graphique s'il en manque.
5. **Valide le résumé** : Claude t'en montre un et demande « on y va ? ». Après ton accord, il travaille seul : création du projet, pages, base de données, couleurs, tests, audit de sécurité.
6. **Ouvre le lien d'installation** que Claude te donne (`http://localhost:3000/setup?token=…`) : clique **Démarrer ma base de données** (3 à 10 minutes la première fois, Docker doit être lancé), puis choisis l'e-mail et le mot de passe de ton **compte administrateur**.
7. **Lis le compte rendu** : ce qui a été construit, ce qui reste à faire de ton côté (clés, domaine, textes légaux).

Compte entre 20 minutes et 1 heure selon la taille du produit.

## 5. Ta charte graphique

Ton SaaS doit ressembler à ta marque, pas à un modèle. Donne à Claude :

| Élément | Exemple | Où ça va dans le projet |
|---|---|---|
| Couleur principale (boutons) | `#6D28D9` ou « violet profond » | `src/app/globals.css`, bloc **CHARTE GRAPHIQUE** |
| Couleur secondaire | `#D4A017` | même bloc |
| Police | Poppins, Inter, Manrope… (Google Fonts) | même bloc + `src/app/layout.tsx` |
| Logo | SVG ou PNG fond transparent, environ 160×40 | `public/logo.svg` + `logo` dans `src/config/site.ts` |
| Icône d'onglet | PNG carré 512×512 | `src/app/icon.png` |
| Ambiance et ton | « sobre et pro, vouvoiement » | textes de la landing, `src/config/site.ts` |

- **Le style de ta landing page** : Claude ne l'invente pas au hasard. Il réfléchit d'abord à ton produit (pour qui, ce que le visiteur doit ressentir, ton prix), puis cherche l'inspiration sur [recent.design](https://recent.design) (landing pages par secteur, motion design) et te propose **3 pistes** avec ce qu'il en reprend et pourquoi. Tu choisis ou tu mélanges. Tu as des sites que tu aimes ? Donne les liens dans le brief. On reprend une idée de structure ou d'animation, jamais le contenu d'un autre site.
- **Pas d'idée ?** Dis « propose-moi » : Claude te montre 3 palettes avec leur police et tu choisis.
- **Lisibilité :** le texte des boutons est blanc, donc la couleur principale doit rester assez foncée. Claude vérifie le contraste pour toi.
- **Changer plus tard :** une phrase suffit (« passe la couleur principale en vert sapin »). Tout le site suit, car les couleurs ne sont définies qu'à un seul endroit.

## 6. Après la création : 5 réglages

1. **Connecte-toi** avec le compte administrateur créé dans l'assistant d'installation.
2. **Colle tes clés.** Ouvre **Admin → Clés et intégrations**. Un bandeau te montre les clés manquantes : clique sur **Renseigner**, colle la clé, **Enregistrer**. Elle est active tout de suite, chiffrée, et jamais réaffichée en entier. Pour les secrets à inventer, le bouton **Générer** le fait pour toi.
3. **Choisis tes moyens de paiement.** **Admin → Paiements** : une passerelle par type (Mobile Money, carte, PayPal). L'adresse du webhook à déclarer chez la passerelle est affichée dans « Clés et intégrations ».
4. **Complète tes informations.** Dans `src/config/site.ts` : e-mail de support et informations de facturation (raison sociale, adresse). Relis les pages légales : ce sont des textes de départ, pas un avis juridique.
5. **Tâches automatiques** (taux de change, expiration des crédits, rattrapage Maketou) : programmées toutes seules à la mise en ligne.

## 7. Mettre en ligne

Tout se fait depuis ton admin, sur ton ordinateur : **Admin → Mise en ligne**.

1. Dans **Admin → Clés et intégrations**, colle :
   - **Adresse de Coolify** (ex. `https://coolify.mondomaine.com`) et **jeton API Coolify** (Coolify → Keys & Tokens → API tokens, droit **root**) ;
   - **jeton GitHub** (github.com/settings/tokens, case `repo`) : ton code part dans un dépôt **privé** ;
   - **jeton Hostinger** ou **Cloudflare** pour régler ton domaine (facultatif : sinon tu règles le DNS toi-même).
2. Dans **Mise en ligne** : écris ton domaine (s'il n'est pas encore acheté, l'admin vérifie s'il est libre et te montre le prix avant tout achat), choisis ton serveur, clique **Mettre en ligne**.
3. Regarde les étapes se cocher : domaine pointé (`ton-domaine.com`, `www` et `api`) → code dans GitHub → **base de données installée sur ton serveur** (`api.ton-domaine.com`, tables créées, ton compte admin et tes clés recopiés) → application créée → variables posées → tâches automatiques → construction → site en HTTPS.

La première fois, compte 15 à 40 minutes (le domaine met parfois du temps à se propager : si une étape attend, relance plus tard, rien n'est créé en double). Ensuite, après chaque changement, **Redéployer** (aussi depuis le site en ligne).

Pour que les e-mails de connexion (confirmation, mot de passe oublié) partent du site en ligne, colle aussi l'**identifiant** et la **clé SMTP Brevo** dans Clés et intégrations avant de mettre en ligne. Sans eux, les comptes sont confirmés sans e-mail.

## 8. Sécurité

Déjà intégré :
- Sécurité ligne par ligne sur chaque table : un client ne voit que ses données.
- Identité toujours lue depuis la session, jamais depuis ce que le navigateur envoie.
- Prix lus côté serveur.
- Paiements reçus vérifiés par signature, crédit jamais compté deux fois.
- Tâches automatiques fermées sans secret.
- Clés chiffrées en base.
- Journal d'audit des actions admin.
- Limitation du nombre de tentatives.
- En-têtes de sécurité du navigateur.

Avant chaque livraison, Claude passe l'**audit complet en 11 domaines** (voir la section 9) et te montre le tableau : chaque domaine doit être ✓ ou ⚠, jamais ✗.

Tes règles à toi :
- Dépôts GitHub toujours **privés**.
- Ne colle jamais une clé dans le chat ni dans le code : utilise **Clés et intégrations**.
- Ne partage jamais `SUPABASE_SERVICE_ROLE_KEY`.

## 9. Auditer un SaaS (le tien ou celui d'un client)

Quelqu'un t'envoie son SaaS (dossier, lien GitHub ou ZIP) ? Dis à Claude :
> audite ce SaaS : <chemin ou lien>

Claude le passe sur la grille des **11 domaines d'un bon SaaS** (détail case par case : [references/checklist-saas.md](references/checklist-saas.md)) :

| # | Domaine | La question |
|---|---|---|
| 1 | **Authentification et comptes** | Inscription, connexion, déconnexion, mot de passe oublié : solides et impossibles à forcer ? |
| 2 | **Droits d'accès** | Un client peut-il voir ou modifier les données d'un autre ? Un client peut-il se faire admin ? |
| 3 | **Paiements et facturation** | Peut-on payer moins, être crédité deux fois, falsifier un paiement ? Factures et historique ? |
| 4 | **API** | Chaque route vérifie-t-elle qui appelle et ce qu'on lui envoie ? |
| 5 | **Sécurité technique** | Clés oubliées, failles dans les dépendances, injections, en-têtes, serveur |
| 6 | **Robustesse** | Pannes, lenteurs, sauvegardes, surveillance, tâches automatiques |
| 7 | **Rentabilité** | Marge de chaque offre, coût de l'IA ou des SMS, point mort, ventes perdues |
| 8 | **Données personnelles et légal** | Confidentialité, CGU, suppression et export des données, consentement |
| 9 | **Design et accessibilité** | Charte partout, aucun élément natif du navigateur, mobile, lisibilité |
| 10 | **Performance et référencement** | Vitesse, Google, aperçus sur les réseaux sociaux |
| 11 | **Qualité du code** | Tests, vérifications automatiques, migrations, documentation, capacité à évoluer |

**Ce que tu reçois dans le chat** : le tableau des 11 domaines (✓ conforme, ⚠ à améliorer, ✗ à corriger, ? à vérifier) avec une note sur 100, les urgences expliquées simplement, puis les failles domaine par domaine (authentification, paiement, API…), chacune avec l'endroit et la correction. Le détail complet est dans `AUDIT-COMPLET.md`.

Concrètement, Claude :
1. récupère le code sans rien lancer de risqué ;
2. passe **4 scanners automatiques** (sécurité, rentabilité, robustesse, produit) qui rangent leurs signaux dans les 11 domaines ;
3. vérifie à la main ce qu'une machine ne voit pas : qui peut lire les données de qui, qui peut se créditer, ce que coûte vraiment un client, ce qui se passe quand un service tombe ;
4. pour la rentabilité, te demande tes vrais coûts (serveur, IA, passerelle) et calcule la marge de chaque offre, le nombre de clients qu'il te faut pour couvrir tes frais et le prix minimum de chaque offre ;
5. te donne le rapport dans le chat et écrit `AUDIT-COMPLET.md` (plus les rapports détaillés `AUDIT-SECURITE.md`, `AUDIT-RENTABILITE.md`, `AUDIT-ROBUSTESSE.md`) : chaque problème avec sa preuve et sa correction ;
6. après ton accord, **corrige** sur une branche à part, revérifie tout et te donne les notes avant / après, plus ce que tu dois faire toi-même (changer une clé qui a fuité, régler les sauvegardes, valider un nouveau prix).

Tu peux aussi demander une seule rubrique : « vérifie la rentabilité de ce SaaS », « vérifie s'il est solide ».

Ce qu'il ne fait jamais :
- tester un site en ligne sans l'accord de son propriétaire ;
- toucher aux vraies données des clients ;
- changer un prix sans ton accord ;
- afficher un secret trouvé : il dit seulement où il est.

## 10. Faire évoluer ton SaaS

Ouvre Claude Code dans le dossier du projet et demande simplement : « ajoute un export Excel des rendez-vous », « ajoute une offre annuelle à 50 000 FCFA ». Claude crée une migration neuve pour la base (il ne casse jamais l'existante), teste, puis repasse l'audit.

Pour mettre à jour le skill (nouvelles passerelles, corrections) :

```bash
cd ~/.claude/skills/starter-saas && git pull
```

## 11. Problèmes fréquents

| Ce que tu vois | Que faire |
|---|---|
| `/starter-saas` n'apparaît pas | Le dossier doit être exactement `~/.claude/skills/starter-saas` et contenir `SKILL.md`. Redémarre Claude Code. |
| `git clone` refuse l'accès | Invitation GitHub pas acceptée, ou pas connecté : `gh auth login`. |
| « Clé manquante » alors que tu l'as mise sur le serveur | La valeur ressemble encore à un exemple (`your-…`) : colle la vraie clé dans **Clés et intégrations**. |
| Une clé « à ressaisir » | La clé de chiffrement a changé (nouvelle base) : colle de nouveau la clé concernée. |
| « Docker n'est pas lancé » dans l'assistant | Ouvre Docker Desktop, attends la baleine fixe, reclique. |
| « Un port de la base est déjà pris » | Un autre projet utilise les mêmes ports : demande à Claude de changer les ports dans `supabase/config.toml`. |
| « Clés de la base illisibles dans Coolify » | Recrée le jeton Coolify avec le droit **root**. |
| Le site ne répond pas après la mise en ligne | Le domaine se propage encore (jusqu'à quelques heures) : relance **Redéployer** plus tard. |
| Le client a payé mais n'a pas ses crédits | **Admin → Commandes** → Vérifier. Contrôle aussi l'adresse du webhook chez la passerelle. |
| Pas d'accès à `/admin` | Connecte-toi avec le compte créé dans l'assistant d'installation. |
| Le site affiche « maintenance » | **Admin → Maintenance** → désactiver. |

Une autre question ? Demande à Claude dans le dossier du projet : il connaît le modèle (`CLAUDE.md`).
