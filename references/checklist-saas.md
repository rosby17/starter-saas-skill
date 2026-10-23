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
- [ ] Validation en deux étapes AU CHOIX (code par e-mail ou application), codes de secours, jamais de code dans le sujet d'un e-mail ; l'admin l'exige (`emails-et-deux-etapes.md`).

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
- [ ] **Affiliation** (si le produit a des partenaires, parrainage ou revendeurs ; méthode `references/affiliation.md`) : rattachement au parrain sur TOUS les chemins d'inscription, premier parrain gagne, jamais soi-même ; une seule commission par commande (index unique), annulée au remboursement, retirable après un délai ; soldes calculés depuis un grand livre (jamais une colonne modifiable) ; activation sur crédit atomique (jamais sous zéro) ; retrait réservé tout de suite et plafonné aux gains disponibles ; affilié limité dans le temps ; tables en RLS sans écriture du navigateur ; noms réservés pour le lien `/<nom>` ; adresse des filleuls masquée pour un affilié ; toutes les actions admin journalisées.

## 4. API et intégrations
- [ ] Chaque route : identité vérifiée (sauf routes publiques voulues), entrée validée par un schéma (types, longueurs, valeurs permises).
- [ ] Les erreurs renvoyées au client sont génériques ; le détail part dans les journaux.
- [ ] Les actions qui modifient passent en POST / PUT / DELETE, jamais en GET.
- [ ] Limitation de débit sur les routes coûteuses (IA, e-mails, SMS, exports) et publiques.
- [ ] Appels sortants : délai maximal, nouvelle tentative raisonnable, erreur gérée proprement.
- [ ] Clés d'API remises aux clients (si le SaaS en donne) : stockées hachées, révocables, limitées.
- [ ] CORS : seulement les origines voulues, jamais `*` avec identifiants.
- [ ] Page « Clés et intégrations » : tuiles avec les logos officiels, état, saisie dans une fenêtre, clés chiffrées actives sans redéploiement, lien aussi dans le menu du profil ; l'aide dit le type de clé attendu (`integrations-et-cles.md`).

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
- [ ] Les réponses des clients ARRIVENT : l'adresse « Répondre à » (support@) a une boîte ou un renvoi actif (`dig MX`), une seule ligne `v=spf1`, test envoyé depuis une autre adresse et reçu hors spam (`emails-et-deux-etapes.md`, « Recevoir les réponses »).
- [ ] Les e-mails partent VRAIMENT : bouton « exemple de chaque e-mail » cliqué (tous « Envoyé ») ; journal des e-mails avec la réponse du fournisseur ; un e-mail urgent attend la réponse et affiche la vraie erreur.
- [ ] Logiciel installé : mise à jour en trois temps (fond, fin du travail, assistant + retour arrière), paquet demandé avec `?b=<build>`, fenêtre qui se reconnecte et est mise à jour aussi (`logiciel-installe-mises-a-jour.md`).

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
- [ ] Nouveau flux de données (résumés, notifications) : politique de confidentialité mise à jour (quoi, pourquoi, combien de temps).
- [ ] Chaque promesse de la pub, de la landing et du store vérifiée dans le code (`promesses-marketing.md`) ; chaque chiffre annoncé est mesuré.

## 9. Expérience, design et accessibilité
- [ ] AUCUN élément natif du navigateur (listes, calendriers, cases, fenêtres `alert/confirm`) : tout aux couleurs du site.
- [ ] **Aucune fenêtre native** : `grep -rnE "(^|[^.\w])(window\.)?(confirm|alert|prompt)\("` sur le code (site, espace client, admin) ne trouve que des fenêtres maison (`useConfirm` / `useInform`) ; la fenêtre maison a titre, texte, bouton principal, Annuler, rouge si dangereuse, Échap = annuler, Entrée = valider, focus piégé, `role="alertdialog"` + `aria-modal`, et s'affiche bien en clair ET en sombre.
- [ ] Charte appliquée partout (couleurs, police, logo, icône d'onglet), y compris e-mails, factures, pages d'erreur.
- [ ] Parfait sur téléphone (375 px) : menus, tableaux, formulaires, fenêtres.
- [ ] Chaque action donne un retour : chargement, succès, erreur compréhensible (en français, avec la marche à suivre).
- [ ] États vides utiles (« Aucun projet : créer le premier »), premier pas guidé après l'inscription.
- [ ] **Simplicité** (`references/simplicite-interface.md`) : accueil à trois choses (action principale, en cours, mes objets) sans KPI ni erreurs brutes ; états en 3 mots ; interrupteur Simple | Avancé visible partout, Simple par défaut ; menu en groupes pliables sans entrée cachée ; assistant de création en 3 écrans ; « Premiers pas » qui se coche tout seul ; une personne neuve lance l'action principale SANS aide (test avec 3 personnes).
- [ ] Toute l'interface est traduite dans chaque langue proposée (`references/traductions.md`) ; une langue longue (allemand) et une écriture de droite à gauche (arabe) ne cassent aucun écran.
- [ ] Accessibilité de base : contraste suffisant, texte alternatif des images, langue de la page, navigation au clavier, libellés des champs.
- [ ] Téléphone : ☰ avec les noms des pages et ← sur chaque écran connecté, « ← Mon compte » sur les pages autonomes (paiement, facture) ; aucune page ne dépasse 375 px (`mobile-navigation.md`).
- [ ] Langue : menu déroulant d'une ligne, pas de grille. Choix d'un utilisateur : recherche pendant la frappe, pas un e-mail à taper.
- [ ] Chiffres affichés honnêtes : « – » plutôt qu'un chiffre non mesuré ; dates avec fuseau (`suivi-a-distance-et-statistiques.md`).

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
