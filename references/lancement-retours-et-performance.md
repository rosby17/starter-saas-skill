# Lancement d'une nouveauté, retours des testeurs, offre d'essai et performance

Leçons d'iziVoice du 13 au 25/10/2026 qui ne sont pas (encore) une brique du modèle : à appliquer à la main
sur chaque SaaS quand le besoin se présente.

## 1. Faire tester une nouveauté avant de la vendre

- **Banc à l'aveugle** (page publique `/ecoute` avec lien privé) : les testeurs comparent plusieurs versions sans
  savoir laquelle est laquelle ; votes et statistiques dans l'admin. La version d'origine est présentée en premier,
  chaque variante porte un prénom fixe (jamais « modèle B »), la page reste claire même en thème sombre.
- **Anti-triche** : les boutons de réponse ne se débloquent qu'après l'écoute (ou la lecture) réelle, en continu ;
  le serveur vérifie que 85 % de chaque extrait a été entendu et que le temps passé est plausible.
- **Invitations récompensées** : lien personnel `?i=<jeton>` envoyé aux 100 comptes les plus actifs (préparer la
  liste, puis envoyer, chaque étape confirmée) ; récompense en crédits versée UNE fois, quand tout le test est fini ;
  ceux qui ont refusé les e-mails sont écartés.
- **Questionnaire des bêta-testeurs** (`/beta/<campagne>`) : six questions en une minute (naturel, ressemblance,
  comparaison explicite avec ce qu'ils utilisent d'habitude, défauts, usage, commentaire), comptes connectés.
  Le serveur relie chaque réponse aux dernières créations du testeur (6 h) : on sait de quoi il parle.

## 2. Annoncer une nouveauté

- **Annonce en fenêtre** avec visuel (flyer carré, colonne `image_url`) et un bouton qui ouvre l'outil AVEC la
  nouveauté déjà choisie (paramètre d'URL appliqué une seule fois, puis le client reste libre de changer).
- Fenêtre bornée en hauteur et défilante : sur téléphone, une annonce longue ne doit jamais cacher son bouton.
- **« Nouveautés » limitées aux 7 derniers jours**, et le numéro de version du site incrémenté à chaque lot livré
  (`package.json` + `CHANGELOG.md` + liste des nouveautés affichée).
- Bannière « nouveauté » de l'accueil pilotée par un seul fichier de configuration (voir SKILL.md, 13/10).
- **Gratuité temporaire** d'un service pour lancer une nouveauté (« illimité jusqu'au … ») : voir `comptes-et-credits.md`.

## 3. Offre d'essai et paliers

- **Bonus d'inscription** modeste (iziVoice : 5 000 puis 3 000 crédits) : assez pour essayer, pas pour vivre gratuitement.
- **Offre d'essai cachée** (petit pack, ex. 2 000 FCFA) : jamais affichée sur la grille. Proposée une seule fois
  au testeur qui a épuisé ses crédits gratuits sans rien acheter et qui revient au moins 2 h après sa dernière
  création : fenêtre à son retour (une fois par session) + notification + e-mail au prix de son pays, réservée
  à un compte qui n'a jamais payé. Les envois sont notés dans une table d'événements pour ne jamais se répéter.
- Le gros bloc « sur-mesure » (curseur, « autre montant ») a été retiré de la page d'achat : il faisait hésiter.
  Le circuit serveur reste pour les offres faites à la main.
- **Paliers gros volumes** nommés (Business, Pro, Entreprise) pour les clients qui consomment beaucoup.
- Dans un sélecteur d'options payantes, **afficher le coût de chaque option** (en crédits) et trier de la plus chère
  à la moins chère ; le compteur montre le coût réel du travail en cours, jamais un pourcentage.

## 4. Inscription : « Comment nous avez-vous connus ? »

- Plusieurs réponses possibles, pas de nom d'ami obligatoire, logos officiels des réseaux (simple-icons).
- Cartes identiques et neutres : seuls les logos gardent leur couleur ; la couleur de la marque marque le survol et
  la réponse choisie (avec une coche) ; vérifier les logos noirs (TikTok, X) en thème sombre.
- Pages de connexion et d'inscription équilibrées : formulaire d'un côté, visuel qui montre le produit de l'autre.

## 5. Performance et robustesse

- **Page d'accueil servie depuis la mémoire** : son HTML est identique pour tous les visiteurs d'une langue.
  Le proxy la rend au plus une fois par minute et par langue, la garde en mémoire et sert une copie un peu ancienne
  pendant qu'il la rafraîchit. Seulement les vraies visites de `/` (pas de paramètres, pas de requête RSC, prefetch
  ou server action). iziVoice : 5 → 80 pages/s à 50 visiteurs simultanés.
- **Drapeau de maintenance lu au plus toutes les 10 s**, pas une requête en base à chaque page et chaque appel d'API.
- **Tâches planifiées bornées** (nombre de lignes traitées par passage, durée maximale) : un rattrapage sans
  limite a épuisé la mémoire du serveur (16/10). Même règle pour les rattrapages de paiement (45 s, 6 s par appel).
- **Envois de gros fichiers** : le proxy de Next ne garde que 10 Mo du corps d'une requête par défaut ; au-delà,
  le fichier arrive tronqué et l'erreur est incompréhensible. Relever la limite dans `next.config.ts` (option
  `proxyClientMaxBodySize` / `middlewareClientMaxBodySize` selon la version, plafond Cloudflare 100 Mo) et, pour les
  gros fichiers, faire envoyer directement vers le stockage (lien d'envoi signé). Un corps tronqué répond 413 avec
  la marche à suivre, AVANT tout débit de crédits.
- **Copier dans le presse-papiers** : toujours `copyText()` de `src/lib/clipboard.ts` (ne lève jamais d'erreur,
  dit si la copie a réussi). `navigator.clipboard.writeText` sans `catch` remontait en erreur JavaScript.

## 6. Ranger le code par domaine

Quand `src/lib` dépasse une trentaine de fichiers à plat : un dossier par domaine (`payments/`, `credits/`,
`engines/`, `email/`, `security/`, `site/`…), un commit par domaine déplacé (`git mv`, imports corrigés, build
vérifié à chaque fois), puis une **carte de `src/lib` dans le README** (un domaine = une ligne : ce qu'il contient).
Le modèle du kit est déjà rangé ainsi : garder la règle pour chaque nouveau fichier.
