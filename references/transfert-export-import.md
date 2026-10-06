# Exporter / importer un espace de travail (un seul fichier à donner)

Appris de KappGen (06/10/2026) : « Exporter la marque » fabrique UN zip que la personne donne à quelqu'un ; l'autre l'importe et retrouve tout (réglages, ADN, style, routines, images, bibliothèque) prêt à produire. Valable pour tout SaaS dont les clients construisent quelque chose de réutilisable (un projet, un modèle, une marque, un espace d'équipe).

## Ce qui part, ce qui ne part JAMAIS
- **Part** : la fiche de l'objet (réglages, méthode, rythme, programme), ses consignes, ses ressources (images, sons, modèles), la bibliothèque partagée de sa catégorie, en option ses éléments déjà produits.
- **Ne part jamais** : comptes de réseaux sociaux et identifiants, clés d'API et connecteurs, identifiants de voix ou de ressources payantes liés au compte de la première personne, dossiers de sortie et chemins personnels (`/Users/…`), adresses de chaînes, licence, ET l'état de publication (une vidéo exportée ne doit jamais repartir sur les comptes de l'autre). La fiche est **réécrite** à l'export (liste noire de clés personnelles), jamais copiée telle quelle. Test : le zip ne contient aucune des chaînes personnelles posées dans la fiche de test.
- Un manifeste (`type`, `format`, version, date, nom, ce qui est inclus) en tête du zip ; refuser un format plus récent que la version du logiciel (« mettez à jour »).

## Export
- Aperçu avant de lancer (nombre de fichiers, images, poids) ; options à cases maison : « vidéos déjà faites » (désactivé par défaut : lourd), « bibliothèque de la catégorie » (activé, seulement si elle existe).
- Écrire le zip dans un fichier temporaire du dossier de travail, l'**envoyer par morceaux** (jamais `read_bytes()` d'un fichier de plusieurs Go), puis le supprimer (`finally`).
- Droit requis (gestion) + l'objet doit être visible par l'utilisateur ; une ligne dans le journal d'audit.

## Import (c'est ici que sont les risques)
1. **Origine de la requête vérifiée** (en-tête `Origin` = `Host`) et droit de gestion ; corps brut = le zip (pas de JSON), taille plafonnée (`Content-Length` > 0 et < limite), lecture par morceaux dans un fichier temporaire, **espace disque vérifié** avant (3 × la taille + marge).
2. **Valider avant d'écrire** : le zip est lisible, le manifeste est du bon type et du bon format, la fiche est complète, nombre de fichiers et poids total annoncés < limites, **licence/quota** (« ce pack ne permet pas ce réseau »).
3. **Chemins sûrs** : refuser `..`, chemins absolus, lecteurs Windows, octets nuls ; vérifier que `cible.resolve()` reste sous le dossier de destination ; appliquer la liste d'exclusion MÊME à l'import (un zip fabriqué à la main peut contenir `comptes/`).
4. **Compter ce qui est réellement copié** (la taille annoncée par un zip peut mentir) et arrêter au-delà de la limite.
5. **Tout ou rien** : sur la moindre erreur (zip abîmé, chiffré, compression inconnue, disque plein, nom refusé par le système), supprimer le dossier créé et répondre par un **message clair** (`ValueError` → 400), jamais une erreur 500 ni un dossier à moitié rempli.
6. **Conflit de nom** : jamais d'écrasement ; l'objet importé s'appelle « Nom (2) » et on le dit. Une bibliothèque partagée ne remplace jamais une ressource déjà présente.
7. **Refaire l'infrastructure de la personne** : recréer ses tâches planifiées / routines avec SES comptes ; ce qui manque (outil non installé) devient un **conseil** dans le résultat (« à créer plus tard : … »), pas une erreur ; dire ce qui demande un redémarrage.
8. Résultat lisible : « « X » est prête · N images · routines créées », puis « Dernière étape : reliez vos propres comptes ».

## Où mettre les boutons
« Exporter la marque » dans « Personnaliser » (et la rangée Avancé) ; « Importer » sur la liste des objets ET sur le premier écran de l'assistant de création (« On m'a donné une marque : l'importer »), parce que la personne qui reçoit un zip n'a pas encore d'objet.

## Tests à écrire (modèle : `tests/test_transfert.py` de KappGen)
Export contient le nécessaire et rien de personnel ; l'option « déjà produit » garde les fichiers mais pas l'état de publication ; aller-retour complet ; import deux fois = « (2) » sans rien écraser ; licence refusée = rien créé ; zip piégé (`../`) refusé sans rien laisser ; zip quelconque / abîmé / trop gros refusé ; chaque organisation de dossiers du produit (chez KappGen : « universelle » ET « marques », la seconde avec la bibliothèque de la niche) ; route : connexion obligatoire, droit, fichier non zip refusé.

## Piège de test
Les tests d'import qui créent des routines écrivent dans le VRAI dossier personnel de la machine (`~/.claude/…`) : simuler la fonction de création (`mock.patch`) dans les tests, et lancer les espaces d'essai à la main avec un `HOME` factice.
