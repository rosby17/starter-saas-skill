# Formules par palier (Gratuit, Pro, Premium) et finitions appréciées

Appris sur ORA le 06/11/2026 (pasteur numérique, Vite + Supabase auto-hébergé, Warappay). Roosevelt veut ces choix sur TOUS ses SaaS. Code de référence : dépôt `bic234/ora-appv` (`supabase/migrations/20261106000600_plans.sql`, `supabase/functions/_shared/pricing.ts`, `src/pages/Subscribe.tsx`, `functions/api/[fn].ts`).

## 1. Formules

- Trois formules : **Gratuit**, **Pro**, **Premium** (noms simples, pas de jargon métier). Chaque formule comprend tout ce que donne celle du dessous, et la carte le dit en premier (« Tout ce que donne Pro »).
- Les formules sont **en base** (table `plans` : prix africain en FCFA, plafond par jour, droits), jamais dans le code. Gratuit = les réglages par défaut (consultation offerte, durée courte).
- Les droits (quota du jour, durée, options réservées) sont **vérifiés côté serveur**, dans la fonction SQL qui réserve l'action (verrou par utilisateur), avec une erreur précise par droit (`PLAN_LENGTH`, `PLAN_FOR_OTHERS`, `DAILY_LIMIT`). L'interface ne fait qu'annoncer.
- Dans l'interface, une option réservée reste visible avec un **cadenas** et « Avec Premium » ; un clic ouvre un encart « compris dans la formule Premium » + bouton « Voir les formules ». Les réponses déjà données sont gardées (sessionStorage) pour reprendre au même endroit.
- Au mois ou **à l'année avec une remise** (20 % par défaut, réglable). Même formule rachetée : prolongée à la suite. Formule supérieure : active tout de suite. Formule inférieure à celle en cours : refusée par le serveur.
- Abonnement acheté = `orders.plan_id`, `period`, `days`, `country`, `display_amount`, `display_currency` fixés par le serveur au moment du paiement ; `settle_order` lit tout dans la commande.

## 2. Prix par pays (PIB par habitant), en complément de `tarification-pays-engagement.md`

- Prix enregistré = prix africain en FCFA. Ailleurs × coefficient du palier, **réglable dans l'admin** (onglet « Formules et prix », avec l'exemple du prix pour chaque palier et pour quelques pays : Cameroun, Côte d'Ivoire, France, Belgique, Canada, États-Unis).
- Affichage : FCFA en Afrique, € en zone euro, $ ailleurs, avec un **prix psychologique en x,99** (4,95 € → 4,99 €). Le montant payé chez la passerelle FCFA est recalculé depuis ce prix affiché et noté sur la carte (« Réglé en francs CFA : 3 273 FCFA »).
- ORA : Pro 2 500 FCFA (4,99 € en France), Premium 5 000 FCFA (9,99 €) avec haut revenu ×1,3, très haut ×1,6.
- **Pays fiable quand le site et le serveur sont sur deux hôtes** (Pages Cloudflare + Supabase sur Coolify sans proxy) : le site passe par un relais (`functions/api/[fn].ts`) qui ajoute `request.cf.country` et un secret partagé (`ORA_PROXY_SECRET`, posé dans Pages ET dans Coolify). Le serveur ignore le pays sans ce secret, et le paiement sans relais est refusé (403) : impossible d'obtenir le prix africain en appelant le serveur directement.
- Sur la page : **seulement « Paiement sécurisé. »** Ni le nom de la passerelle, ni « les prix tiennent compte du pouvoir d'achat de ton pays ».

## 3. Carte de formule

- Trois cartes côte à côte qui passent à la ligne (`repeat(auto-fit, minmax(250px, 1fr))`), jamais trois colonnes écrasées quand la barre latérale prend de la place.
- La formule mise en avant est foncée, avec un badge « Le plus complet » **à l'intérieur de la carte**, au-dessus du titre (jamais à cheval sur le bord).
- La formule en cours est entourée ; son bouton devient « Prolonger ma formule », les formules inférieures « Compris dans ta formule ».

## 4. Espace connecté

- **Barre latérale = seulement les rubriques principales** (ORA : Mon espace, Mes programmes, Études, Prières) + l'action principale. Compte, abonnement, paramètres, administration et déconnexion sont dans le menu du profil (en haut à droite).
- Repliable : **petit bouton rond posé sur le bord de la barre** (chevron), pas dans la barre du haut, loin de la barre.
- Page « Paramètres » distincte du profil (prénom, mot de passe avec œil, déconnexion, suppression du compte).

## 5. Connexion et clés

- Le bouton Google n'apparaît que si Google est activé sur le serveur (`/auth/v1/settings` → `external.google`), et réapparaît tout seul une fois les clés renseignées.
- Onglet admin « Clés et intégrations » : Google, paiement, IA, pré-remplis, œil pour les secrets, adresses à copier (URI de redirection, webhook). Les fonctions lisent d'abord la table `app_secrets` (fermée à tous sauf la clé service), puis les variables du serveur. Le journal note quelle clé a changé, jamais sa valeur.
- Supabase auto-hébergé : GoTrue lit Google au démarrage. Une tâche cron sur l'hôte (`scripts/ora-google-sync.sh`, jeton Coolify en fichier root 600, jamais dans un conteneur) recopie les deux valeurs dans Coolify et redémarre le service quand elles changent.

## 6. Contenu et images

- Les pages de l'espace connecté (programmes, suivi) ont un bandeau illustré, les **vrais chiffres de la personne** (en cours, jours faits, terminés ; jamais de chiffres inventés), les éléments en cours séparés des terminés, et un court « comment ça se passe ».
- Des **photos de personnes du public visé** (ORA : chrétiens africains en prière), générées gratuitement (Google Flow, Nano Banana), en `.webp` dans `public/img`, avec repli propre si l'image manque.
- Logo : une icône qui dit le métier (ORA : une Bible qui s'ouvre et une croix qui se lève), animée une fois à l'ouverture, en boucle pendant un chargement, rien si l'appareil demande moins d'animations.
