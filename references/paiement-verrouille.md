# La page de paiement verrouillée (brique obligatoire du kit)

Validée en production le 10/10/2026 sur une plateforme de formation (Afrique de l'Ouest et centrale + diaspora). Depuis, c'est **la seule page de paiement** de tous les SaaS créés avec le kit, et de tous les sites audités : on ne recode plus jamais un paiement, on installe la brique.

## Ce que voit le client

Une fenêtre en deux colonnes (une seule sur téléphone) :

- **À gauche, le récapitulatif** : logo et nom du site, « Paiement sécurisé », le titre, le prix en très gros, le prix barré et la remise (« −25 % »), la ligne du produit (« Accès à vie », « Renouvelable, sans engagement », « Réservation (10 % du prix) », « 1 000 crédits ajoutés à ton solde »…), le total dû aujourd'hui, les points forts, puis « Paiement chiffré · Accès immédiat · Facture PDF ».
- **À droite, les coordonnées puis le moyen de paiement** : nom, e-mail, WhatsApp (indicatif avec drapeau, pays par défaut de `site.payments.defaultCountry`), pays. Client connecté : une carte avec sa photo, son nom, son e-mail et son numéro, et « Modifier ». Visiteur : son compte est créé à partir de son e-mail.
- **Moyens** (seuls ceux qui sont configurés s'affichent, `/api/payment/methods`) :
  - **Mobile Money** (Orange, MTN, Moov…) : TOUJOURS facturé en FCFA, même si l'adresse IP est en Europe ou en Amérique (VPN, relais privé) ;
  - **Wave** : manuel. Montant exact, numéro et référence copiables d'un clic, 3 étapes, bouton WhatsApp pré-rempli si `site.whatsapp` est rempli ;
  - **Carte bancaire** et **PayPal** : page sécurisée de la passerelle ;
  - **Crypto (USDT)** : onglets Binance Pay (ID + nom) et USDT TRC20 sans compte Binance (adresse + QR code, avertissement « réseau TRON uniquement ») ; un seul onglet si une seule des deux est réglée.
- Bouton « Payer 15 000 FCFA », mention du montant prélevé et de la devise, lien vers les conditions de vente. Erreurs dans la fenêtre (jamais d'alerte du navigateur), « Me connecter » si le produit est déjà acheté.

## Ce qui se passe derrière

1. `POST /api/payment/checkout` : limite de tentatives, prix lu en base (promo, précommande 10 % puis solde 60 %), règles d'accès (abonnement d'un cours réservé à ses acheteurs, « Pro » réservé aux élèves, communauté déjà incluse, achat à vie pas deux fois ; appel et crédits se rachètent), prix par zone (FCFA en Afrique et en Asie, € en Europe, $ dans les Amériques ; Mobile Money toujours en FCFA), passerelle active puis les autres du même moyen en secours, commande `pending` avec coordonnées, IP, pays, zone, crédits et validité, cookie signé qui lie le navigateur à la commande.
2. Paiement : webhook signé (Tara Money, Warappay), retour du client (`/paiement/succes` interroge `verify`), cron `reconcile-orders` toutes les 5 minutes (rattrapage puis annulation après 30 min), ou validation à la main dans `/admin/orders` (Wave, Binance, USDT) avec le détail reçu (moyen, référence, montant, note).
3. Livraison : `credit_paid_order` (SQL) passe la commande en `success` et accorde l'accès (produit + produits inclus) ou verse les crédits, en UNE opération : jamais deux fois. Puis e-mail « Ton accès est prêt » avec lien de connexion directe et **facture PDF jointe**, et alerte à l'administrateur.

## Le verrou

- `paiement.lock.json` : l'empreinte SHA-256 de chacun des 35 fichiers de la brique (liste dans `scripts/verrou-paiement.mjs`).
- `npm run lint` et `npm run build` (script `prebuild`, donc aussi la construction Docker sur le serveur) lancent `node scripts/verrou-paiement.mjs` : un fichier modifié ou supprimé = échec, avec la liste et quoi régler à la place. La CI GitHub fait de même.
- `--signer` ne fonctionne que dans le kit (dossier `template/` à côté du `SKILL.md` de starter-saas).

## Ce qu'on règle SANS toucher à la brique

| Réglage | Où |
|---|---|
| Nom, logo, couleur, police | `site.ts`, `globals.css` (`--brand`), `brand-font.ts` |
| Numéro WhatsApp des captures, pays par défaut, exemple de numéro | `site.whatsapp`, `site.payments` |
| Clés Tara Money, Warappay, numéro Wave, Binance Pay ID, adresse USDT | `/admin/keys` (fenêtres pré-remplies) |
| Passerelle active pour chaque moyen | `/admin/payment-providers` |
| Produits, prix, prix barrés, promos, précommandes, packs de crédits | `/admin/products` |
| Barème des zones (Europe, Amériques) | dans la brique : se change dans le kit |

## Faire évoluer la brique

Uniquement dans le dépôt du kit : modifier `template/…`, vérifier (`tsc`, lint, build, achat réel en local de bout en bout), puis `node template/scripts/verrou-paiement.mjs --signer`, commit, et réinstaller dans chaque projet avec `scripts/installer-paiement.sh`. Ajouter une passerelle : un adaptateur dans `gateways/`, son enregistrement dans `gateways/index.ts` et `providers.ts`, ses clés dans `secrets/catalog.ts` et `services.ts`, son webhook ; ajouter les nouveaux fichiers à `FILES` du script de verrou.

## Installer la brique sur un autre site (audit, ancien SaaS)

```bash
bash <dossier du skill>/scripts/installer-paiement.sh <dossier du projet>
```

Le script copie les 35 fichiers, `paiement.lock.json`, `scripts/verrou-paiement.mjs`, ajoute les scripts npm (`lint`, `prebuild`, `verrou-paiement`) et la dépendance `qrcode`, puis lance `tsc` et liste ce qui manque AUTOUR de la brique (à adapter dans le projet, jamais dans la brique) :

- tables et colonnes : `products` (prix FCFA, promo, précommande, crédits), `entitlements`, `preorders`, `orders` (coordonnées, `purchase_kind`, `client_ip`, `ip_country`, `price_zone`, `paid_at`, `is_test`…), fonctions `credit_paid_order` et `grant_product_access` → reprendre les migrations du modèle (`template/supabase/migrations/`) dans des migrations NEUVES du projet ;
- modules appelés par la brique : `lib/catalog/*`, `lib/customers.ts`, `lib/currency.ts`, `lib/invoices/invoice.ts`, `lib/email/*`, `lib/auth/access-link.ts`, `lib/rate-limit.ts`, `lib/site-url.ts`, `lib/calls/slots.ts`, `lib/catalog/slugs.ts`, `config/site.ts` (`whatsapp`, `payments`, `company`), `CheckoutProvider` dans le layout racine et `CatalogProvider` ;
- les anciens boutons d'achat du site remplacés par `openCheckout('<slug>')` ;
- les anciennes commandes migrées (statuts, montants) et l'ancienne page de paiement supprimée.

Puis : `npm run lint`, `npm run build`, un achat réel de bout en bout en local (Wave en manuel suffit), et un contrôle dans `/admin/orders`.
