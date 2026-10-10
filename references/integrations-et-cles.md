# Clés et intégrations : une page qu'on comprend d'un coup d'œil

Appris de KappGen (06/10/2026). La page des clés était une liste de cartes repliées, chacune avec un carré coloré et une LETTRE :
« on ne reconnaît pas les services, ça embrouille ». Et elle était rangée tout en bas du menu : le propriétaire ne la trouvait pas.

## La page (modèle : `template/src/app/admin/keys`)
- **Grille de tuiles**, 3 colonnes sur grand écran, 2 sur tablette, 1 sur téléphone (`repeat(auto-fill, minmax(270px, 1fr))`), rangées par usage
  (E-mails, Paiement, Connexion, Votre entreprise…), avec une phrase d'aide par groupe (« une seule passerelle suffit pour commencer »).
- **Chaque tuile** : le LOGO OFFICIEL du service dans une pastille blanche 48×48 (lisible en clair ET en sombre), le nom, un badge d'état
  (Configuré vert · « 1 sur 2 » ambre · À configurer rouge · Facultatif gris), une phrase qui dit à quoi sert le service, un bouton
  « Configurer » (principal) ou « Modifier » (secondaire). Jamais d'initiale dans un carré : sans logo disponible, un pictogramme clair
  (enveloppe pour SMTP, immeuble pour les mentions légales, téléphone pour le Mobile Money).
- **En haut** : « 6 services prêts sur 10 · 2 à configurer » + filtres en pilules (Tous / À configurer / Configurés).
- **La saisie dans une fenêtre** (Échap et clic à côté ferment) : logo + nom, lien « Où la trouver » qui mène à la bonne page du fournisseur
  (avec le chemin écrit : « Brevo › Paramètres › Clés API »), les champs PRÉ-REMPLIS avec la valeur en place
  (ou la `defaultValue` du catalogue quand le code en a une), un secret masqué avec l'œil pour l'afficher, tout modifiable
  directement ; seuls les champs changés partent, un champ vidé retire la valeur de l'admin ; « Annuler / Enregistrer ».
  JAMAIS de champ vide « laisser vide pour garder » (retour de Roosevelt, 10/10/2026 : on doit voir ce qui est en place).
  Lecture des valeurs : `GET /api/admin/secrets?values=NOM1,NOM2` (admin seulement, `no-store`, journalisée). Ne jamais déplier une tuile dans la grille : ça casse la mise en page.
- **Trouvable** : dans le menu ET dans le menu du profil (avatar) de l'administrateur.
- Les clés sont chiffrées en base et prises en compte tout de suite, sans redéploiement ; « retirer » rend la valeur de l'hébergeur.

## Logos
- Fichiers dans `public/logos/services/` (SVG de préférence). Pour les récupérer : le logo du site du fournisseur (`og:image`,
  `apple-touch-icon`), sinon le service de favicons de Google (`https://www.google.com/s2/favicons?domain=<domaine>&sz=128`).
  Rejeter les images trop petites (16 px : floues) ; vérifier qu'un SVG ne contient pas de `<script>`.
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
