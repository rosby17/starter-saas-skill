# {{APP_NAME}}

SaaS créé avec le kit **starter-saas** : site public, comptes clients, espace client, administration, paiements africains et internationaux, mise en ligne sur ton serveur. Un seul modèle pour tous les types de SaaS :

| Type de SaaS | Ce qui est prêt | Modules (`src/config/site.ts`) |
|---|---|---|
| **Formation / cours en ligne** | Formations en parcours (leçons en étapes, vidéos privées, quiz, questionnaire d'accueil, plan personnalisé par l'IA), accompagnements, précommande (10 % puis 60 %), abonnement « Rester à jour », communauté façon WhatsApp, avis vérifiés et projets d'élèves, appel d'une heure à réserver | `formations`, `communaute`, `avis`, `appels` |
| **Boutique de produits numériques et services** | Catalogue en rayons, fichiers à télécharger, liens vers un logiciel externe, services sur devis avec formulaires de départ | `boutique`, `demandes` |
| **SaaS à l'usage** (voix, images, générateurs d'applications…) | Packs de crédits, solde, historique, fenêtre « crédits insuffisants », débit atomique avant chaque action payante, expiration | `credits` |

Tous les types partagent la **page de paiement verrouillée** du kit (voir plus bas), la facture PDF, les e-mails, les statistiques et l'administration.

## Ce que voit chacun

| Qui | Ce qu'il fait |
|---|---|
| **Visiteur** | Accueil construit à partir du catalogue, pages Formations et Boutique, fiche de chaque produit. Il peut acheter **sans compte** : son compte est créé avec son e-mail au paiement. |
| **Client** | Son espace : achats, parcours des formations, crédits, communauté, appels, demandes, factures, compte (photo, pseudo, validation en deux étapes, export et suppression de ses données). |
| **Administrateur** (`/admin`) | Statistiques, commandes (validation des paiements manuels), clients, formations et produits (leçons, fichiers, annonces), appels, demandes, avis, support, annonces, clés et intégrations, moyens de paiement, e-mails, santé du site, ressources serveur, mise en ligne, maintenance. |

## Personnaliser

1. `src/config/site.ts` : nom, personne, logo, accroche de l'accueil, « À propos », FAQ, réseaux, numéro WhatsApp, fuseau horaire, **modules**.
2. `src/app/globals.css` : `--brand` et `--brand-dim` (couleur de marque). Police : `src/app/fonts/brand-font.ts`.
3. `public/logo.svg`, `src/app/icon.png`, `public/pwa/*` (icônes de l'application installable), `public/og.png` (aperçu des liens), `public/invoice-logo.png` (facultatif, logo des factures).
4. `/admin/products` : remplace le **catalogue d'exemple** (formation, accompagnement, abonnement, communauté, appel, pack de crédits, service sur devis) par tes produits et tes prix.

## La page de paiement (verrouillée)

Moyens proposés au client : **Mobile Money** (Orange, MTN, Moov… toujours facturé en FCFA), **Wave** (envoi au numéro réglé + capture WhatsApp), **carte bancaire**, **PayPal**, **crypto** (Binance Pay ou USDT TRC20 avec QR code). Seuls les moyens configurés apparaissent.

- Passerelles : Tara Money et Warappay (Mobile Money, carte, PayPal), avec bascule automatique sur l'autre si l'une refuse ; Wave et Binance / USDT en validation manuelle dans `/admin/orders`.
- Réglages : clés dans `/admin/keys`, passerelle active par moyen dans `/admin/payment-providers`.
- Prix par zone (FCFA en Afrique, € en Europe, $ dans les Amériques), adresse IP, pays et zone notés sur chaque commande.
- **Verrou** : `npm run lint` et `npm run build` vérifient que les fichiers de la brique n'ont pas bougé (`paiement.lock.json`, `scripts/verrou-paiement.mjs`). On ne les modifie pas dans un projet ; une amélioration se fait dans le kit et se réinstalle partout.

## Démarrer en local

```bash
npm install
npm run dev
```

Puis ouvre `http://localhost:3000/setup` : l'assistant démarre la base de données locale (Supabase open source dans Docker), applique les migrations et crée ton compte administrateur.

## Mettre en ligne

Dans `/admin/deploy` : domaine, serveur Coolify, dépôt GitHub privé, base de données sur ton serveur, tâches planifiées, puis déploiement. Les clés de `/admin/keys` sont recopiées en ligne.

## Vérifier avant de livrer

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Puis un essai réel dans le navigateur : inscription → connexion → achat → déconnexion.
