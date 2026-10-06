# Travailler à plusieurs sessions et livrer sans rien casser

Appris de KappGen (05-06/10/2026) : plusieurs sessions Claude travaillent EN MÊME TEMPS sur le même dépôt (interface, montage, installateurs, site). Ce qui a évité les catastrophes, et ce qui a coûté du temps.

## Avant de pousser
1. **`git fetch` puis compter le retard** (`git log HEAD..origin/main`). Il bouge pendant qu'on travaille : l'autre session a poussé 6 commits pendant une reconstruction. Refaire le fetch JUSTE avant `git push` ; un refus (« non-fast-forward ») = refusionner, jamais forcer.
2. **Un seul gros commit « tout » est acceptable** quand deux chantiers se mêlent dans les mêmes fichiers (on ne peut pas les séparer proprement) ; sinon un commit par sujet. Ne jamais embarquer les fichiers locaux de la machine (`.claude/`, copies de test).
3. **Fusionner** : fichiers de listes (CSS, journaux de versions, dictionnaires) = union des deux côtés ; code = lire les deux versions et reporter les ajouts de l'autre dans la structure de l'une (ex. la charte réécrite d'un côté, la banque d'images ajoutée de l'autre : les 5 réglages sont devenus des options de la charte). Après chaque résolution : `node --check` / `python -c ast.parse`, aucun `<<<<<<<` restant (`grep`).
4. **Relancer TOUS les tests après la fusion**, pas seulement ceux de ses changements : un test écrit par l'autre session a attrapé un contrat que j'avais cassé (nom et signature d'une fonction mockée).
5. **Reconstruire les paquets après la fusion**, jamais avant : le binaire poussé par l'autre session ne contient pas son travail à soi. Commit des paquets à part (« Paquet reconstruit »).

## Après avoir poussé
- **Vérifier en ligne** que le serveur sert BIEN la version construite (empreinte du paquet : `curl …/version.json` = fichier local). Un 403/301 sans agent navigateur n'est pas une panne : ajouter un `User-Agent`.
- Dire à la personne ce qui n'est PAS dans le paquet en ligne (source poussée mais paquet pas reconstruit) et quelle commande le reconstruit.

## Ne pas casser les vraies données de la machine
- Les espaces d'essai se lancent avec un `HOME` factice (et jamais dans `/tmp`, vidé au redémarrage) : sinon un essai d'import crée de vraies routines dans l'installation de la personne.
- Les tests qui appellent une création d'infrastructure (routines, tâches planifiées, dossiers système) la simulent (`mock.patch`).
- Un espace d'essai affiche parfois les vraies données de la machine (27 vraies routines vues dans la liste) : ne cliquer sur aucune action.
- Supprimer un dossier de test lourd (node_modules) demande l'accord de la personne : le signaler plutôt que de le supprimer en douce.

## Réflexes de livraison
- Le suivi du projet (fichier de suivi, journal des versions, nouveautés clients) est mis à jour à CHAQUE étape, pas à la fin.
- Les nouveautés clients parlent de bénéfices (« Exporter une marque en un clic »), jamais de la technique.
- Un test de bout en bout par route sensible (connexion obligatoire, droit, entrée invalide) en plus des tests de module.
- Lire le rapport d'audit complet avant de corriger : beaucoup de signaux sont de fausses alertes sur une pile inhabituelle (voir `references/audit-autre-pile.md`).
