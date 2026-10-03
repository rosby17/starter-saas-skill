# Mode audit de sécurité : auditer et corriger le SaaS de quelqu'un d'autre

But : dire clairement ce qui est dangereux dans un SaaS existant, le prouver, le classer, puis le corriger proprement.
Le scanner automatique trouve les signaux évidents ; les failles graves d'un SaaS sont presque toujours dans la LOGIQUE
(qui peut lire ou modifier quoi, qui paie quoi) et se trouvent en lisant le code.

## 0. Règles (toujours)

- **Autorisation** : on audite le CODE que l'utilisateur nous confie. Aucun test d'attaque contre un site en ligne sans l'accord écrit de son propriétaire (et jamais de déni de service, jamais de vraies données de clients).
- **Rien n'est exécuté à l'aveugle** : pas de `npm install` avec scripts (`npm ci --ignore-scripts` si un build est nécessaire), pas de `npm run` d'un script inconnu avant de l'avoir lu.
- **Secrets** : on dit OÙ est un secret (fichier, ligne, commit), on ne l'affiche pas, on ne le copie pas, on n'ouvre pas les coffres d'identifiants (profils de navigateur, trousseaux, bases de mots de passe). On recommande de le révoquer.
- **Aucune donnée de production** : pas de connexion à la base en ligne du client, pas de requête sur ses vraies données.
- **Corrections sur une branche** `audit/securite`, jamais sur `main`, jamais de push sur le dépôt de quelqu'un sans son accord.

## 1. Récupérer le code

- Dossier local : travailler dedans (créer la branche `audit/securite`).
- Dépôt Git : `git clone <adresse> ~/Documents/dev/audits/<nom>` puis la branche.
- Archive ZIP : la décompresser dans `~/Documents/dev/audits/<nom>`, `git init` + premier commit (pour voir les corrections en diff).

Repère en 2 minutes : framework, base de données, authentification, paiements, hébergement (package.json, dossiers, `.env.example`, migrations, Dockerfile).

## 2. Scanner automatique

```bash
python3 "<dossier du skill>/scripts/audit_securite.py" <dossier> --sortie <dossier>/SCAN-AUTOMATIQUE.md
```

Il cherche : secrets (gitleaks sur tout l'historique s'il est installé), dépendances vulnérables (`npm audit`, faille Next.js du middleware), tables sans RLS et politiques ouvertes, clés serveur dans le navigateur, rôle admin lu dans `user_metadata`, routes et actions sans contrôle d'identité, webhooks sans signature, crons ouverts, identité ou montant pris dans la requête, injections (SQL, filtres Supabase, XSS), redirections ouvertes, en-têtes de sécurité, limitation de débit, Docker en root.

Chaque ligne est un SIGNAL. Confirme-la en lisant le code avant de la mettre dans le rapport ; écarte les fausses alertes et dis pourquoi.
Le scanner se teste avec `python3 tests/test_audit.py` (faux SaaS plein de failles connues : tout doit être trouvé).

## 3. Revue manuelle (là où sont les vraies failles)

Pour CHAQUE route API, action serveur et page privée, réponds à ces questions :

**Identité et droits**
1. Qui peut appeler ça sans être connecté ? (le middleware ne suffit pas : la page ou la route doit revérifier)
2. L'identité vient-elle de la session (bien) ou d'un champ envoyé par le navigateur (faille IDOR) ?
3. Quand on lit, modifie ou supprime une ressource par son identifiant, vérifie-t-on qu'elle appartient à l'utilisateur ? Essaie mentalement avec l'identifiant d'un autre client.
4. Les routes admin vérifient-elles le rôle côté serveur, dans une donnée que l'utilisateur ne peut pas modifier ?
5. Le client « service » (qui ignore la RLS) n'est-il utilisé qu'après ces contrôles ?

**Base de données** (Supabase)
6. RLS sur chaque table ; politiques par propriétaire / admin ; aucune politique `true` en écriture.
7. Colonnes sensibles (rôle, crédits, statut de paiement, abonnement) non modifiables par l'utilisateur, même sur sa propre ligne (déclencheur ou politique de colonne).
8. Fonctions `security definer` : `search_path` fixé, droits d'exécution limités.
9. Stockage (buckets) : privés si les fichiers sont personnels, politiques par propriétaire.

**Argent**
10. Le prix vient du catalogue serveur, jamais du navigateur.
11. Webhook : signature vérifiée en temps constant ; montant et devise comparés à la commande ; commande créditée UNE seule fois (opération atomique) ; adresse de retour fixée côté serveur.
12. Un paiement « réussi » au retour du navigateur est revérifié auprès de la passerelle.
13. Crédits ou quotas : débit atomique (pas de lecture puis écriture séparées), pas de valeur négative.

**Données et navigateur**
14. Aucune donnée d'un autre client dans les réponses (listes filtrées par propriétaire, champs sensibles retirés).
15. Contenu utilisateur affiché sans HTML brut ; e-mails HTML échappés.
16. Envoi de fichiers : type et taille limités, nom régénéré, jamais servi comme HTML.
17. Appels vers une adresse fournie par l'utilisateur (aperçu de lien, import par URL) : risque SSRF, liste blanche.
18. Redirections et liens d'e-mail : adresse du site fixée côté serveur, chemin interne seulement.

**Comptes**
19. Mot de passe oublié, confirmation d'e-mail, changement d'adresse : pas de prise de contrôle possible ; limitation de débit.
20. Suppression de compte et export de données (RGPD) si clients européens.

**Exploitation**
21. Erreurs : pas de trace technique ni de secret renvoyé au navigateur ; journaux sans clé ni mot de passe.
22. Crons, tâches et routes internes protégés par un secret.
23. Sauvegardes de la base et plan de restauration ; dépendances à jour ; HTTPS forcé.

## 4. Classer

| Niveau | Définition | Exemple |
|---|---|---|
| **CRITIQUE** | Exploitable maintenant, sans compte ou avec un compte gratuit, avec perte d'argent ou de données | table sans RLS, webhook sans signature, rôle admin dans user_metadata, secret dans le dépôt |
| **HAUTE** | Exploitable avec un compte, ou dans un cas courant | IDOR, montant pris du navigateur, cron ouvert |
| **MOYENNE** | Durcissement manquant qui aggrave une autre faille | en-têtes absents, pas de limitation de débit, conteneur root |
| **BASSE** | Bonne pratique | journalisation, documentation |

## 5. Rapport : `AUDIT-SECURITE.md` à la racine du projet

En tête, pour le propriétaire (non technique) : une note globale (A à E), les 3 risques principaux en une phrase chacun, et ce qu'il doit faire LUI (révoquer telle clé, prévenir ses clients si des données ont pu fuiter).

Puis, pour chaque faille confirmée :
- **Titre** et **niveau**
- **Où** : fichier:ligne
- **Scénario d'attaque** en 2 phrases (qui, comment, ce qu'il obtient) : c'est la preuve.
- **Correction** proposée
- **Statut** : à corriger / corrigée (commit) / acceptée par le propriétaire

Termine par « Vérifié sans problème » : la liste de ce qui a été contrôlé et trouvé correct (ça compte autant que les failles).

## 6. Corriger (après UN accord de l'utilisateur)

1. Ordre : CRITIQUE, puis HAUTE, puis MOYENNE.
2. Une correction = un commit clair sur `audit/securite` (« Sécurité : RLS sur orders »). Base de données : une migration NEUVE, rejouable, jamais la modification d'une migration déjà appliquée.
3. Corrige la cause, pas le symptôme (ex. contrôle de propriétaire dans un utilitaire partagé plutôt que dans une seule route), sans réécrire ce qui marche.
4. Après les corrections : `tsc`, lint, build, tests existants, puis relance le scanner : plus aucun CRITIQUE ni HAUTE confirmé.
5. Ce qui ne se corrige pas dans le code (révoquer une clé, nettoyer l'historique Git, régler l'hébergeur) va dans la liste « À faire par le propriétaire » du rapport.
6. Mets le rapport à jour (statuts, commits) et donne un résumé court : note avant / après, failles corrigées, ce qui reste à faire de son côté.

Une faille trouvée qui pourrait exister dans le modèle du skill : vérifie `template/` et corrige-le aussi.
