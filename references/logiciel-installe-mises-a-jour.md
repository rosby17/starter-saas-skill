# Logiciel installé chez le client : installer et mettre à jour sans le figer

Appris de KappGen (06/10/2026). Les mises à jour figeaient l'application ; sur Mac la fenêtre affichait « Impossible d'afficher la page »
et il fallait « Réessayer » ; parfois la mise à jour « ne prenait pas ».

## Mettre à jour en trois temps
1. **Télécharger en arrière-plan** avec une vraie barre (%, Mo) ; le logiciel reste utilisable. Le paquet est vérifié (empreinte SIGNÉE
   par l'éditeur avec une clé de publication gardée hors du serveur) et décompressé à côté (`programme.neuf/`).
2. **Ne jamais couper un travail en cours** : s'il y en a un, le dire (« montage de « X », 42 % ») et proposer « Mettre à jour dès que c'est
   fini » (par défaut : plus aucun nouveau travail, installation à la fin) ou « Arrêter et mettre à jour maintenant ».
3. **Un assistant séparé** (copie autonome du module, lancé détaché) attend la fermeture, remplace le programme, relance, vérifie que la
   nouvelle version répond ; sinon il remet l'ancienne et la relance (retour arrière). Aucune désinstallation : seul le dossier du
   programme change, jamais les données.
- **La fenêtre suit** : écran plein avec les étapes (fermeture, installation, redémarrage, vérification) ; elle interroge la version
  jusqu'à ce que la nouvelle réponde, puis se recharge. Jamais de délai fixe.
- **Les applications « fenêtre »** (Mac WKWebView, Windows WebView2) : quand le serveur local ne répond pas, afficher « … redémarre » et
  réessayer pendant une minute, au lieu d'une page d'erreur. Et les METTRE À JOUR AUSSI (sinon elles restent celles du jour de
  l'installation : leurs corrections n'arrivent jamais) ; garder ce qui est embarqué dedans (installateur).
- **Cache** : un paquet au nom stable est gardé en cache par le CDN (4 h) : le demander avec `?b=<build>`, sinon un ancien paquet arrive.
- **Rappel** : la PREMIÈRE mise à jour d'une copie déjà installée passe par son ANCIEN code ; la nouvelle manière vaut dès la suivante.
- Tester pour de vrai : faux dossier « installé » + faux site (`file://`), mise à jour de « ancien » vers « neuf », et un test du retour arrière.

## Page d'installation
- Proposer TOUS les systèmes développés (Mac, Windows, Linux .deb + script pour les autres Linux), celui de la personne en premier.
- Retirer les avis d'avant le lancement (« Version de test… ») le jour du lancement : les relire tous.
