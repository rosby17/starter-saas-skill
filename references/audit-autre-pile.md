# Auditer un produit qui n'est pas Next.js + Supabase

Appris de l'audit de KappGen (06/10/2026) : logiciel local en Python (bibliothèque standard) + JavaScript maison, site en Python. Première passe des scanners : **0/100, ~100 « failles », presque toutes fausses**. Après correction des scanners : 82/100 et des signaux utiles. Les scanners savent maintenant lire ce genre de pile ; ce document dit COMMENT revoir à la main ce qu'ils ne voient pas.

## Ce que les scanners reconnaissent maintenant (testé : `tests/test_autre_pile.py`)
- Pages légales trouvées par leur **route** dans le serveur (`"/confidentialite"`), pas seulement par un fichier `page.tsx`.
- Limitation des tentatives : `essais.bloque`, `lockout`, `brute_force`, `too many attempts`… (pas seulement `rate-limit`).
- `innerHTML` : UN signal par fichier (plus un par ligne) ; « À VÉRIFIER » si le fichier a un échappeur (`esc`, `echap…`, `escapeHtml`, `sanitize`), « MOYENNE » sinon.
- Santé, remontée des erreurs : `/api/sante`, `rapports.noter`, `error_logs`…
- Migrations / variables d'environnement : seulement si une vraie base serveur / un projet Next est présent.
- Mot de passe trop court : seulement dans un contexte de mot de passe (plus de faux signal sur une animation « passe 1 »).

## Revue à la main d'un serveur Python + JS maison (ce que les scanners ne couvrent pas)
1. **Sessions** : cookie `HttpOnly` + `SameSite` (Lax/Strict), durée raisonnable, renouvelée à l'usage, mot de passe initial refusé hors de l'ordinateur local.
2. **Requêtes venues d'un autre site (CSRF)** : écritures en JSON obligatoire (le navigateur ne l'envoie pas en cross-origin sans permission) ; les routes à corps brut (téléversement, import) vérifient `Origin` = `Host`.
3. **Chemins de fichiers** : chaque route qui lit/écrit un chemin donné par le client passe par une fonction qui refuse `..` et sort du dossier autorisé (explorateur de dossiers, `/fichier?p=`, import de zip).
4. **Téléversements** : taille maximale par type, écriture dans un fichier temporaire puis renommage, espace disque vérifié, jamais d'écrasement (nom-2), extension contrôlée.
5. **Échappement** : toute valeur insérée dans un gabarit HTML passe par l'échappeur, SAUF constantes et SVG internes ; relire les `${…}` des fichiers « À VÉRIFIER ». Gabarits de messages d'erreur serveur affichés tels quels = à échapper.
6. **Processus lancés** (`subprocess`) : arguments en liste (jamais une chaîne passée au shell), jamais une valeur du client dans une commande ; délai maximal.
7. **Secrets** : jamais dans le dépôt ni dans le paquet livré (`admin/` exclu du paquet, vérifié par un test) ; les clés de service saisies dans l'interface sont chiffrées/masquées avec un œil.
8. **Pannes** : un service extérieur qui ne répond pas ne bloque pas le serveur (délais), les erreurs des clients remontent dans un journal lisible (référence donnée au client), les écritures de fichiers sont atomiques (temporaire → renommage).
9. **Légal** : les pages sont servies par le SITE (landing), pas forcément par le logiciel local : chercher « confidentialité / conditions / mentions » dans tout le dépôt avant de conclure qu'elles manquent.
10. **Fichiers énormes** : un fichier JavaScript de plus de 800 lignes (ex. `app.js` à 1900) est un signal de qualité, pas une urgence ; le découper par écran au moment de le modifier, pas avant.

## Méthode
1. `python3 scripts/audit_complet.py <dossier> --sortie /chemin/hors/du/dépôt/AUDIT.md` (ne pas écrire le rapport dans le dépôt audité sans accord).
2. Lire chaque signal : fausse alerte → corriger le SCANNER (et ajouter le cas à `tests/test_autre_pile.py`), vraie faille → corriger le PRODUIT.
3. Revue à la main de la liste ci-dessus, en commençant par le code récent (le plus de risques : les nouveautés n'ont pas encore été relues).
4. Rendre compte : note avant/après, ce qui était faux, ce qui a été corrigé, ce que le propriétaire doit faire.
