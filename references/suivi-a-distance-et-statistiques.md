# Résultats, amélioration automatique, rapport par e-mail, notifications sur le téléphone

Appris de KappGen 2.1 (06/10/2026). La pub promettait « il s'améliore tout seul », « rapport par e-mail », « notifications en temps réel » ;
rien n'existait (voir `promesses-marketing.md`). Voici comment on l'a construit sans API payante ni dépendance.

## Des chiffres honnêtes
- Relever les chiffres à un rythme dégressif : toutes les 6 h les 2 premiers jours, puis chaque jour (14 j), chaque semaine (90 j), chaque mois.
- **Un chiffre « à 48 h » ou « à 7 jours » n'existe que s'il a vraiment été relevé autour de ce moment** (interpolé entre deux relevés qui
  l'encadrent, ou le premier relevé fait moins d'un jour après). Sinon « – ». Jamais un chiffre de 5 jours présenté comme « 48 h ».
- **Taux d'amélioration** = médiane des vues à 7 jours des n dernières publications / médiane des n précédentes (n ≤ 5, au moins 4 mûres).
- Écarter les données douteuses (ex. un identifiant de vidéo publiée AVANT le contenu : l'outil de publication s'était trompé de vidéo).
- Dates enregistrées avec leur fuseau (`isoformat()` avec décalage) : sinon un calendrier se décale d'une heure selon le pays ; tester
  sous plusieurs `TZ`.

## La boucle d'amélioration
Dès 3 publications comparables, écrire un fichier lisible « ce qui marche » (chiffres, meilleures, moins bonnes, consignes : reprendre la
recette, jamais le titre ; les consignes de la marque passent avant) et l'ajouter aux consignes que lit l'IA AVANT de choisir le sujet et
d'écrire. Le montrer dans l'interface (« Voir ce qu'ils lisent »). Ne le réécrire que si les chiffres changent.

## Suivre d'où l'on est (logiciel installé → site)
- Le logiciel envoie toutes les 5 min au site : un résumé par objet (états, chiffres) + les événements NOUVEAUX (en ligne, prête, à régler).
  Au tout premier passage, ne rien annoncer (sinon une avalanche). Sans Internet : garder les événements et les renvoyer plus tard.
- Authentifié par la clé de licence ET un ordinateur activé dessus ; taille limitée ; liens `https://` seulement.
- **Rapport par e-mail** au rythme choisi (à chaque publication, chaque soir à HH:MM, chaque semaine le jour J), toujours à l'adresse du
  compte, 30 par jour au plus ; « M'envoyer un exemple maintenant ».
- **Page « Mes … » dans l'espace client**, lisible sur téléphone, + **notifications Web Push** : réveil SANS contenu signé VAPID (ES256 ;
  faisable en Python pur, vérifié par OpenSSL), puis la page de service lit les notifications avec la session et les affiche. Pas de
  chiffrement de contenu à écrire. iPhone : ajouter à l'écran d'accueil d'abord. Notification d'essai à l'activation.
- Mettre à jour la politique de confidentialité (ce qui part, pourquoi, combien de temps) dès qu'un nouveau flux de données existe.
