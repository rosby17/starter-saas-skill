# Brief de mon SaaS (à remplir avant de lancer)

Copie ce fichier, remplis ce que tu sais, puis colle-le à Claude avec « starter saas : » devant.
Tu peux laisser des cases vides : Claude prendra une valeur par défaut et te la montrera avant de commencer.
Tu peux aussi tout dicter à voix haute, dans le désordre : Claude remet en forme.

---

## 1. Le produit
- **Nom du SaaS** :
- **Promesse en une phrase** (ce que le client obtient) :
- **Pour qui** (métier, pays, niveau) :
- **Le problème qu'il résout** :
- **Les 3 à 5 actions principales du client** (ex. « créer un rendez-vous », « envoyer un rappel ») :
- **Ce que voit et fait l'administrateur** (en plus de l'admin déjà fourni) :
- **Langue de l'interface** : français / anglais / les deux

## 2. Les données
Pour chaque chose que le client crée ou gère :
- **Nom** (ex. Rendez-vous) : ses champs (date, client, statut…), qui peut la voir, qui peut la modifier.

## 3. L'argent
- **Modèle** : gratuit / abonnement mensuel-annuel / crédits / paiement unique / à vie
- **Offres et prix** (nom, prix, ce qui est inclus, durée d'essai) :
- **Devise affichée** : FCFA (XOF/XAF) / EUR / USD
- **Moyens de paiement** : Mobile Money / carte / PayPal / crypto (Binance) / aucun
- **Passerelles** (si tu sais) : Maketou, Tara Money, Warappay, GeniusPay, K-Pay, autre :
- **Infos pour les factures** : raison sociale, adresse, numéro fiscal

## 4. Charte graphique
- **Ambiance** : sobre et pro / chaleureux / coloré et jeune / luxe / technique
- **Couleur principale** (boutons) : code hex (ex. `#0F766E`) ou description (« vert sapin »)
- **Couleur secondaire** (badges, mises en avant) :
- **Police** : une police Google Fonts (ex. Inter, Poppins, Manrope, DM Sans) ou « par défaut »
- **Logo** : fichier SVG ou PNG fond transparent (chemin sur ton ordinateur), ou « pas encore »
- **Icône d'onglet** (favicon) : PNG carré 512×512, ou « faire à partir du logo »
- **Sites dont tu aimes le style** (1 à 3 liens) :
- **Ton des textes** : tutoiement / vouvoiement ; simple / expert

**Inspiration :** des sites dont tu aimes le style (liens), et pourquoi ? Pas d'idée : Claude cherche pour toi sur https://recent.design et te propose 3 pistes adaptées à ton produit.
- Sites que j'aime :
- Ce que je veux que le visiteur ressente en 5 secondes (confiance, énergie, calme, sérieux, plaisir…) :
- Animations : discrètes / marquées / aucune

Pas d'idée ? Écris « propose-moi » : Claude te montre 3 palettes avec leur police et tu choisis.

## 5. En ligne
- **Nom de domaine** (ex. monsaas.com) : acheté ? oui / non
- **Fournisseur du domaine** : Hostinger / Cloudflare / autre (DNS réglé à la main)
- **E-mail de contact du support** :
- **E-mails envoyés aux clients** : oui (Brevo) / non

## 6. Ce qu’il faut avoir
- [ ] Docker Desktop lancé (la base de données tourne dedans, aucun compte Supabase à créer)
- [ ] Un serveur avec Coolify (4 Go de mémoire minimum) pour la mise en ligne
- [ ] GitHub (pour garder le code, en dépôt PRIVÉ)
- [ ] Brevo (e-mails), si e-mails : https://brevo.com
- [ ] Compte marchand de chaque passerelle de paiement choisie
- [ ] Jeton API du fournisseur de domaine (Hostinger ou Cloudflare)
