# Clés et intégrations : une page qu'on comprend d'un coup d'œil

Appris de KappGen (06/10/2026). La page des clés était une liste de cartes repliées, chacune avec un carré coloré et une LETTRE :
« on ne reconnaît pas les services, ça embrouille ». Et elle était rangée tout en bas du menu : le propriétaire ne la trouvait pas.

## La page (modèle : `template/src/app/admin/keys/page.tsx`, refaite d'après Ballon Viral le 07/11/2026)
- **Toute la largeur**, pas de colonne centrée étroite. En haut : titre, recherche, filtres en onglets maison (Toutes / À faire / Renseignées,
  avec leur nombre), puis **4 compteurs** cliquables : actives, manquantes, à ressaisir, facultatives vides.
- **Sommaire collant à gauche**, rangé par THÈMES (Paiements et revenus, E-mails et connexion, Contenu et automatisation, Serveur et mise en
  ligne), une ligne par service avec son logo, une pastille et « 2/3 ». Au centre, chaque thème a son titre et ses services en colonnes CSS
  (`md:columns-2 2xl:columns-3`, `break-inside-avoid`) : les petits services remplissent la largeur au lieu de laisser des trous.
- **Une carte par clé** : libellé, nom technique, pastille d'état (Active, Manquante, À ressaisir, Facultative), fin de la valeur, aide,
  ligne « Copier » pour l'adresse du webhook ou de redirection Google. Bouton « Renseigner » (principal) ou « Modifier », « Effacer » si la
  valeur vient de l'admin (confirmation par la fenêtre maison, jamais `confirm()`).
- **Saisie dans la carte** : champ PRÉ-REMPLI avec la valeur en place (`GET /api/admin/secrets?values=NOM`, admin seulement, `no-store`,
  journalisé) ou la `defaultValue` du catalogue ; `PasswordInput` avec l'œil pour un secret ; attributs `NO_AUTOFILL` (`autoComplete=off`,
  `data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type=other`) pour écarter les gestionnaires de mots de passe. « Générer » à
  gauche, « Annuler » et « Enregistrer » à droite. JAMAIS de champ vide « laisser vide pour garder » (Roosevelt, 10/10/2026).
- **Messages en bas à droite** : la réussite se ferme seule après 4 s, l'erreur reste jusqu'à la croix.
- **Thèmes et logos** : `THEMES` et `SERVICES` dans `src/lib/secrets/services.ts`. Un service = un `group` de `catalog.ts` ; chaque groupe
  a sa ligne (thème, logo, phrase d'usage, lien « Où la trouver »). Un groupe oublié tombe dans « Serveur et mise en ligne » avec la clé grise.
- **Service non utilisé par ce SaaS : `hidden: true`** sur ses clés dans `catalog.ts`. La clé disparaît de la page, des compteurs et du
  bandeau de l'admin, le code reste en place (on la fait revenir en retirant la ligne). Ne jamais supprimer le code d'une passerelle pour ça.
- **Trouvable** : dans le menu ET dans le menu du profil (avatar) de l'administrateur. Lien `?focus=NOM` : ouvre et centre la bonne carte.
- Les clés sont chiffrées en base et prises en compte tout de suite, sans redéploiement ; « Effacer » rend la valeur de l'hébergeur.

## Bandeau de l'administration (`template/src/app/admin/layout.tsx`)
- Il ne parle que des clés **obligatoires** manquantes (`required`, jamais les facultatives ni les cachées).
- Il **nomme le service** qui bloque (« Maketou : 2 clés obligatoires manquent ») au lieu d'un texte général.
- Passerelle de paiement **activée sans clés** : il dit l'effet (« les clients qui le choisissent tombent sur une erreur ») et propose
  « Couper ce moyen » (vers `/admin/payment-providers`) à côté de « Renseigner ».

## Logos
- Fichiers dans `public/logos/services/` (SVG de préférence). Pour les récupérer : le logo du site du fournisseur (`og:image`,
  `apple-touch-icon`), sinon le service de favicons de Google (`https://www.google.com/s2/favicons?domain=<domaine>&sz=128`).
  Rejeter les images trop petites : un 16×16 est le GLOBE par défaut de Google (domaine inconnu), essayer alors `www.<domaine>`
  (Maketou : `maketou.net` donne le globe, `www.maketou.net` le vrai logo). Vérifier qu'un SVG ne contient pas de `<script>`.
- Un logo sert à reconnaître le service, pas à le décorer : jamais retouché, jamais recoloré.

## Pièges rencontrés
- **Mauvais type de clé** : Brevo a des clés « SMTP » (`xsmtpsib-…`) et des clés « API » (`xkeysib-…`). Avec la mauvaise, Brevo répond
  401 « Key not found » et AUCUN e-mail ne part (inscription, mot de passe oublié, reçus…). L'aide du champ doit dire le préfixe attendu,
  et la page doit proposer un bouton d'essai (voir `emails-et-deux-etapes.md`).
- Une clé réglée chez l'hébergeur ET dans l'admin : l'admin gagne, et la page le dit (« (Coolify) » à côté de la valeur sinon).

## Chercher un utilisateur au lieu de taper son e-mail
Partout où l'admin désigne un compte (ajouter un partenaire, offrir des crédits, donner un rôle) : un champ « Rechercher un client : nom ou
e-mail » qui affiche les comptes pendant la frappe (8 au plus, initiale + nom + e-mail, mention « déjà partenaire »), clic = sélection.
Message clair si rien ne correspond (« la personne doit d'abord créer son compte »). Le bouton dit ce qu'il fait : « Ajouter », pas
« Nommer ». Modèle : `template/src/components/admin/UserSearch.tsx`.

## Journal des routines automatiques (Ballon Viral, 07/11/2026)
Pour un SaaS qui reçoit des routines cloud (claude.ai) par une API à jeton (`/api/automation/*`, `Authorization: Bearer $AUTOMATION_TOKEN`).
Le modèle n'a pas encore cette API : à ajouter avec elle.
- **Le jeton vit en deux endroits.** Dans l'admin du site (`AUTOMATION_TOKEN` au catalogue, `generate: true`) : actif tout de suite grâce à
  la synchronisation des clés dans `process.env`. Et dans l'environnement cloud des routines Claude (claude.ai, Code, environnement, variable
  `AUTOMATION_TOKEN`) : c'est une COPIE, à recoller à chaque changement, sinon toutes les routines reçoivent 401.
- **La consigne des routines pointe vers le domaine définitif** (pas une adresse de test ou `sslip.io`) : une ancienne adresse casse l'API
  dès que le site change d'hôte.
- **Journal pour le voir** : table `automation_runs` (route, méthode, statut `accepte` / `refuse` / `desactive`, date), RLS lecture admin
  seulement (`is_admin()`), écriture par le serveur (`service_role`), migration rejouable au format de nom du modèle
  (`supabase/migrations/<horodatage>_automation_runs.sql`). Dans le garde du jeton, `logRun(request, statut)` note chaque appel qui porte un
  `Bearer`, sans jamais bloquer la routine (erreur ignorée). Route `GET /api/admin/automation` (`requireAdmin`, 8 derniers passages,
  `runs: null` si la table manque). Sur la carte du jeton dans Clés, un encadré `RoutineRuns` : « Dernier passage il y a 12 min : jeton
  accepté » en vert, « jeton refusé » en rouge avec la marche à suivre (recopier le jeton dans l'environnement cloud), « aucun passage »
  en gris, et le rappel que changer le jeton ici ne change pas la copie des routines.
