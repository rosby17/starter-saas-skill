# Checklist d'un bon SaaS : 11 domaines

La grille unique du skill, pour CRÉER (étape 7, avant de livrer) et pour AUDITER (mode audit).
`scripts/audit_complet.py` fait la première passe automatique et range ses signaux dans ces 11 domaines.
Les cases ci-dessous sont la revue MANUELLE : ce qu'un scanner ne voit pas (logique métier, parcours réels, chiffres).
Pour chaque case : ✓ vérifié, ✗ faille (avec niveau), ? impossible à vérifier (dire pourquoi).

Niveaux : **CRITIQUE** (exploitable ou perte d'argent tout de suite), **HAUTE** (à corriger avant d'ouvrir au public),
**MOYENNE** (à corriger dans le mois), **À VÉRIFIER** (soupçon à confirmer).

Méthodes détaillées : sécurité `audit-securite.md`, rentabilité `audit-rentabilite.md`, robustesse `audit-robustesse.md`.

## 1. Authentification et comptes
- [ ] Parcours réel : inscription → e-mail de confirmation → connexion → déconnexion → retour sur une page privée (redirigé vers /login).
- [ ] Mot de passe oublié : le lien arrive, n'est valable qu'une fois et expire ; le nouveau mot de passe fonctionne.
- [ ] Mot de passe : 8 caractères au minimum (10 pour un admin), vérifié côté SERVEUR.
- [ ] Tentatives limitées sur connexion, inscription, mot de passe oublié (par IP et par compte).
- [ ] Message identique « e-mail ou mot de passe incorrect » (on ne révèle pas si un compte existe).
- [ ] Côté serveur, l'identité vient de `getUser()` / jeton vérifié, jamais d'un cookie non vérifié ni d'un champ envoyé.
- [ ] Connexion Google / autre : adresse de retour limitée au site ; compte relié à la bonne adresse.
- [ ] Changement d'e-mail ou de mot de passe : demande le mot de passe actuel ou un lien de confirmation.
- [ ] Session : durée raisonnable, déconnexion de tous les appareils possible pour un compte compromis.

## 2. Droits d'accès et données des clients
- [ ] Avec DEUX comptes clients : A ne voit, ne modifie, ne supprime, ne télécharge AUCUNE donnée de B (changer les identifiants dans les adresses et les requêtes).
- [ ] RLS activée sur CHAQUE table, politiques propriétaire / admin, aucune écriture ouverte à `anon`.
- [ ] Colonnes sensibles (rôle admin, crédits, statut de commande, prix) non modifiables par le client.
- [ ] Pages et routes admin : refusées à un client connecté (403), pas seulement cachées dans le menu.
- [ ] Un admin voit tout, mais SES pages client (« Mes paiements ») restent filtrées par `user_id`.
- [ ] Fichiers envoyés : stockage privé, liens signés à durée courte, type et taille contrôlés.

## 3. Paiements et facturation
- [ ] Le prix vient du catalogue serveur ; changer le montant dans le navigateur ne change rien.
- [ ] Webhook : signature vérifiée (comparaison en temps constant), montant ET devise comparés à la commande.
- [ ] Un paiement n'est crédité qu'UNE fois, même si le webhook arrive deux fois ou en même temps que le retour client (verrou / mise à jour conditionnelle).
- [ ] Paiement abandonné, refusé, remboursé, litige : chaque cas a son statut et son traitement.
- [ ] Rattrapage : une tâche planifiée revérifie les commandes en attente ; les commandes jamais payées expirent.
- [ ] Le client voit l'historique de ses paiements et télécharge ses factures (vendeur, numéro, date, montant, devise).
- [ ] L'admin peut vérifier, valider à la main, rembourser / annuler, ajuster des crédits ; chaque geste est journalisé.
- [ ] Mode test de la passerelle essayé de bout en bout avant d'ouvrir.

## 4. API et intégrations
- [ ] Chaque route : identité vérifiée (sauf routes publiques voulues), entrée validée par un schéma (types, longueurs, valeurs permises).
- [ ] Les erreurs renvoyées au client sont génériques ; le détail part dans les journaux.
- [ ] Les actions qui modifient passent en POST / PUT / DELETE, jamais en GET.
- [ ] Limitation de débit sur les routes coûteuses (IA, e-mails, SMS, exports) et publiques.
- [ ] Appels sortants : délai maximal, nouvelle tentative raisonnable, erreur gérée proprement.
- [ ] Clés d'API remises aux clients (si le SaaS en donne) : stockées hachées, révocables, limitées.
- [ ] CORS : seulement les origines voulues, jamais `*` avec identifiants.

## 5. Sécurité technique
- [ ] Aucun secret dans Git (historique compris), dans le code du navigateur, dans les journaux ni dans l'image Docker.
- [ ] `npm audit --omit=dev` : aucune faille haute ni critique ; versions verrouillées (`package-lock.json`).
- [ ] Pas d'injection : SQL paramétré, pas de `dangerouslySetInnerHTML` sur une donnée utilisateur, e-mails HTML échappés.
- [ ] Redirections limitées au site (`?next=` vérifié) ; adresse du site fixée côté serveur, jamais tirée des en-têtes.
- [ ] En-têtes : HSTS, CSP, `frame-ancestors`, `nosniff`, `Referrer-Policy` ; cookies `HttpOnly`, `Secure`, `SameSite`.
- [ ] Conteneur sans root ; dépôt GitHub PRIVÉ.

## 6. Robustesse et exploitation
- [ ] Sauvegardes AUTOMATIQUES de la base vers un stockage externe, et une restauration déjà ESSAYÉE.
- [ ] `/api/health` + contrôle de santé du conteneur + surveillance extérieure qui prévient (e-mail, WhatsApp).
- [ ] Erreurs des clients remontées (journaux lisibles, outil de suivi des erreurs ou au minimum journal serveur).
- [ ] Page d'erreur et page « introuvable » aux couleurs du site ; une panne d'un service extérieur n'emporte pas tout le site.
- [ ] Tâches planifiées protégées par secret et par verrou (jamais deux en même temps).
- [ ] Mise en ligne reproductible (un clic) et retour en arrière possible (version précédente).
- [ ] Listes paginées, index sur les clés étrangères, pas de requête par élément dans une boucle.
- [ ] Mode maintenance disponible.

## 7. Rentabilité
- [ ] Coût réel par client et par action (IA, SMS, stockage, passerelle de paiement, serveur) chiffré avec `calcul_rentabilite.py`.
- [ ] Chaque offre a une marge positive au maximum d'usage permis ; plafonds sur ce qui coûte (crédits débités AVANT l'appel, longueur des réponses d'IA limitée).
- [ ] Point mort connu (combien de clients pour couvrir les frais fixes).
- [ ] Offre gratuite / essai : ne peut pas être exploitée en boucle (confirmation d'e-mail, limites).
- [ ] Parcours d'achat mesuré (visites → inscriptions → paiements), relances des paniers abandonnés et des fins d'essai.
- [ ] Page de tarifs claire : ce qui est inclus, prix dans la devise du client, annuel avantageux.

## 8. Données personnelles et légal
- [ ] Politique de confidentialité, CGU / CGV, mentions légales, liées dans le pied de page.
- [ ] Le client télécharge ses données et supprime son compte lui-même (factures gardées sans lien avec lui).
- [ ] Consentement avant tout traceur publicitaire ; mesure d'audience respectueuse sinon.
- [ ] Seules les données nécessaires sont collectées ; durée de conservation définie ; sous-traitants listés.
- [ ] E-mails marketing : désinscription en un clic.
- [ ] Si le client construit quelque chose de réutilisable : export / import en un fichier, sans aucune donnée personnelle ni état de publication, import sûr et « tout ou rien » (`references/transfert-export-import.md`).

## 9. Expérience, design et accessibilité
- [ ] AUCUN élément natif du navigateur (listes, calendriers, cases, fenêtres `alert/confirm`) : tout aux couleurs du site.
- [ ] Charte appliquée partout (couleurs, police, logo, icône d'onglet), y compris e-mails, factures, pages d'erreur.
- [ ] Parfait sur téléphone (375 px) : menus, tableaux, formulaires, fenêtres.
- [ ] Chaque action donne un retour : chargement, succès, erreur compréhensible (en français, avec la marche à suivre).
- [ ] États vides utiles (« Aucun projet : créer le premier »), premier pas guidé après l'inscription.
- [ ] **Simplicité** (`references/simplicite-interface.md`) : accueil à trois choses (action principale, en cours, mes objets) sans KPI ni erreurs brutes ; états en 3 mots ; interrupteur Simple | Avancé visible partout, Simple par défaut ; menu en groupes pliables sans entrée cachée ; assistant de création en 3 écrans ; « Premiers pas » qui se coche tout seul ; une personne neuve lance l'action principale SANS aide (test avec 3 personnes).
- [ ] Toute l'interface est traduite dans chaque langue proposée (`references/traductions.md`) ; une langue longue (allemand) et une écriture de droite à gauche (arabe) ne cassent aucun écran.
- [ ] Accessibilité de base : contraste suffisant, texte alternatif des images, langue de la page, navigation au clavier, libellés des champs.

## 10. Performance et référencement
- [ ] Titre, description et aperçu réseaux sociaux (Open Graph) sur chaque page publique.
- [ ] `sitemap` et `robots` (admin, espace client et API interdits à l'indexation).
- [ ] Images optimisées (`next/image`, formats modernes), police hébergée avec le site, rien de lourd dans `public/`.
- [ ] Page d'accueil rapide sur mobile (Lighthouse ≥ 90 en performance, accessibilité, SEO).
- [ ] Pages publiques rendues côté serveur ; pas de `"use client"` inutile en haut des pages.

## 11. Qualité du code et évolutivité
- [ ] `tsc` strict, lint et build passent sans erreur ; vérification automatique à chaque envoi de code (CI).
- [ ] Tests sur ce qui touche à l'argent et aux droits (crédit unique, accès entre clients, webhooks).
- [ ] Base de données uniquement par migrations versionnées, rejouables.
- [ ] README à jour (lancer, régler, déployer), `.env.example` complet, `CLAUDE.md` avec les règles du projet.
- [ ] Code découpé (pas de fichiers géants), types précis (peu de `any`), réglages au même endroit (charte, prix, textes).
- [ ] Dépendances à jour, versions verrouillées ; une passerelle / un fournisseur se remplace sans réécrire le site (adaptateurs).

## Rapport à donner dans le chat

1. Le tableau des 11 domaines de `audit_complet.py` (état, nombre de failles par niveau) et la note.
2. Les urgences (CRITIQUE puis HAUTE), chacune en une phrase : le risque concret et la correction.
3. Puis domaine par domaine (authentification, accès, paiement, API, …) : chaque faille CONFIRMÉE avec son niveau, l'endroit et la correction ; les fausses alertes écartées sont dites en une ligne.
4. Ce qui n'a pas pu être vérifié et pourquoi, et ce que le propriétaire doit faire lui-même.
Le détail complet va dans `AUDIT-COMPLET.md` ; le chat reste lisible en une minute.
