# Mode audit : robustesse

But : savoir si le SaaS tient quand il grandit, quand un service extérieur flanche, quand une mise à jour rate ou quand le serveur meurt,
et le rendre solide. Un SaaS qui tombe un jour de forte affluence perd ses ventes et la confiance de ses clients.

## 0. Règles

- **Aucun test de charge ni de panne sur un site en ligne** sans l'accord écrit du propriétaire, et jamais aux heures de forte affluence.
  Par défaut, on travaille sur le code et sur une copie locale.
- **Aucune donnée de production** : les essais de restauration se font sur une copie, jamais sur la base en ligne.
- **Corrections sur la branche** `audit/robustesse`, une migration NEUVE par changement de base.

## 1. Scanner automatique

```bash
python3 "<dossier du skill>/scripts/audit_robustesse.py" <dossier> --sortie <dossier>/SCAN-ROBUSTESSE.md
```

Il cherche :
- les appels extérieurs sans délai maximal ;
- les écritures en base dont l'erreur n'est pas lue ;
- les listes sans limite et les boucles qui font une requête par élément ;
- les clés étrangères sans index, les migrations en double ou destructives ;
- l'absence de pages d'erreur, de contrôle de santé (route et Dockerfile), de remontée d'erreurs, de vérification des variables au démarrage ;
- un build qui ignore les erreurs, TypeScript non strict, des versions « latest » ;
- les tâches planifiées sans verrou, l'absence de tests, d'intégration continue et de sauvegardes.

Chaque ligne est un SIGNAL : la confirmer en lisant le code. Une petite table de réglages n'a pas besoin de pagination ; une table de commandes, si.

## 2. Vérifier pour de vrai (en local)

- **Build** : `npm ci --ignore-scripts`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Tout doit passer sans option qui cache les erreurs.
- **Migrations** : les appliquer toutes, dans l'ordre, sur une base vide, PUIS les rejouer une seconde fois. Les deux passages doivent réussir.
- **Opérations critiques en parallèle** : débit de crédits, crédit d'une commande, utilisation d'un code. Lancer 10 appels simultanés et vérifier
  le résultat : jamais deux fois, jamais négatif. Avec ce kit, la base locale (`/setup`) suffit.
- **Service extérieur en panne** : couper le réseau (ou mettre une mauvaise clé) pendant un paiement ou un envoi d'e-mail. Le client doit voir
  un message clair, sans page blanche ni attente sans fin, et rien ne doit rester à moitié fait.

## 3. Revue manuelle

**Pannes des services extérieurs**
1. Chaque appel extérieur (paiement, IA, e-mail, SMS) a un délai maximal ; un échec affiche un message clair au client ?
2. Ce qui doit arriver (crédit après paiement, e-mail de reçu) arrive même si un service répond en retard : rattrapage, nouvel essai, webhook rejoué ?
3. Une opération en plusieurs étapes (payer → créditer → écrire la facture) ne peut pas rester à moitié faite (une seule transaction, ou reprise) ?

**Base de données**
4. Chaque écriture lit son erreur ; chaque lecture importante aussi (une erreur n'est pas confondue avec « aucun résultat ») ?
5. Les opérations sur l'argent et les crédits sont atomiques et ne peuvent pas s'appliquer deux fois (contrainte unique, verrou, fonction SQL) ?
6. Index sur chaque clé étrangère et sur les colonnes filtrées ou triées (statut, date) des grosses tables ?
7. Les listes sont paginées ; les tableaux de bord calculent en base (count, sum), pas en chargeant toutes les lignes ?
8. Les migrations sont rejouables et n'effacent rien sans sauvegarde préalable ?

**Montée en charge**
9. Pas de requête par élément dans une boucle ; les pages publiques (accueil, tarifs) sont statiques ou en cache ?
10. Les tâches longues (IA, envoi de masse, export) ne bloquent pas la requête du client (tâche de fond, file, ou au moins un délai maximal clair) ?
11. Les fichiers envoyés vont dans un stockage (Supabase Storage), pas sur le disque du conteneur (perdu à chaque mise à jour) ?
12. L'état tenu en mémoire (compteurs, limites, caches) supporte un redémarrage, et plusieurs instances si le SaaS en a ?

**Erreurs et surveillance**
13. Pages d'erreur (error.tsx, global-error.tsx, not-found) claires, avec un bouton pour réessayer ?
14. Les erreurs serveur sont remontées quelque part que quelqu'un regarde (onRequestError, GlitchTip ou Sentry) ?
15. Une route de santé, un HEALTHCHECK dans le Dockerfile, et une surveillance extérieure qui prévient si le site ne répond plus (Uptime Kuma) ?
16. Les variables d'environnement indispensables sont vérifiées au démarrage ?

**Mises à jour et données**
17. Le build vérifie les types et le lint, et une mise à jour qui plante au démarrage ne remplace pas la version qui marche (HEALTHCHECK) ?
18. Un retour à la version précédente est possible en une action (image précédente dans Coolify) ?
19. Sauvegarde automatique quotidienne de la base, HORS du serveur (Coolify, Backups du service de base vers un stockage S3) ?
20. Une restauration a déjà été essayée sur une copie, et on sait combien de temps elle prend ?
21. Les tâches planifiées prennent un verrou, et une exécution ratée est rattrapée à la suivante ?
22. Au moins un test automatique du parcours qui rapporte (inscription → paiement → crédit → usage), lancé à chaque envoi de code ?

## 4. Classer

| Niveau | Définition | Exemple |
|---|---|---|
| **CRITIQUE** | Panne ou perte de données probable | aucune sauvegarde, migration qui efface en ligne, crédit appliqué deux fois |
| **HAUTE** | Panne au premier pic ou au premier incident d'un service | appel de paiement sans délai maximal sur le chemin du checkout, build qui ignore les erreurs, liste des commandes sans limite |
| **MOYENNE** | Fragilité qui aggrave une panne | pas de HEALTHCHECK, erreurs non remontées, index manquant, écriture sans contrôle d'erreur |
| **BASSE** | Bonne pratique | tests, intégration continue, typage strict sur un vieux code |

## 5. Rapport : `AUDIT-ROBUSTESSE.md` à la racine du projet

En tête, pour le propriétaire :
- une note (A à E) ;
- les 3 risques de panne principaux, en une phrase chacun (« si la passerelle répond lentement, les paiements restent bloqués ») ;
- ce qu'il doit faire LUI : régler les sauvegardes chez l'hébergeur, ajouter une surveillance, essayer une restauration.

Puis, pour chaque point :
- **Titre** et **niveau** ;
- **Où** (fichier:ligne) ;
- **Scénario de panne** en 2 phrases (ce qui arrive, ce que voit le client) ;
- **Correction** ;
- **Statut**.

Terminer par « Vérifié sans problème », avec les essais réels faits (migrations rejouées, appels parallèles, panne simulée) et leur résultat.

## 6. Corriger (après UN accord)

1. Ordre : CRITIQUE → HAUTE → MOYENNE. Un commit par correction sur `audit/robustesse`.
2. Ce qui est déjà résolu dans le modèle de ce kit peut s'y reprendre :
   - délais maximaux (`signal: AbortSignal.timeout(15_000)`) ;
   - débit atomique (migration 0009) ;
   - `global-error.tsx`, `onRequestError` dans `instrumentation.ts` ;
   - `HEALTHCHECK` du Dockerfile et `/api/health` hors maintenance dans le middleware ;
   - verrous des crons (`src/lib/cron-lock.ts`) ;
   - vérification des variables au démarrage (`src/lib/env.ts`).
3. Revérifier comme en 2 (build, migrations rejouées, appels parallèles), relancer les trois scanners, donner la note avant / après.
4. Ce qui ne se règle pas dans le code (sauvegardes chez l'hébergeur, surveillance extérieure, essai de restauration) va dans
   « À faire par le propriétaire », avec les étapes.

Un défaut trouvé qui pourrait exister dans le modèle du skill : vérifier `template/` et le corriger aussi.
