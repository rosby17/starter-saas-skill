# Affiliation : revendeurs, associés et affiliés

Système standard de partenariat du kit, tiré d'un produit réel en ligne (KappGen 2.0, 06/10/2026 : moteur Python + SQLite, même logique transposable telle quelle en Next.js + Supabase). Il se branche SUR l'orchestrateur de paiement du modèle (`src/lib/payments/`, `credit_paid_order`) : il ne touche jamais au chemin qui livre la commande, il s'accroche juste après.

À proposer à la création de tout SaaS payant (question « Argent » du SPEC : « Veux-tu des revendeurs ou des affiliés ? ») ; à vérifier dans l'audit dès que le produit en a.

## 1. Les rôles

| Rôle | Qui | Comment il gagne | Taux par défaut | Nommé par |
|---|---|---|---|---|
| **Affilié** | N'importe quel client qui recommande le produit | Commission sur CHAQUE paiement de ses filleuls pendant une durée limitée (12 mois) | 10 % | Lui-même (bouton « Obtenir mon lien ») ou l'admin |
| **Revendeur partenaire** | Vendeur extérieur (agence, formateur, revendeur local) | En ligne : sa part de chaque paiement de ses clients, SANS limite de durée tant que le client reste le sien. Hors ligne : il encaisse lui-même et active la licence en payant la part de l'éditeur sur un CRÉDIT prépayé | 80 % (l'éditeur garde 20 %) | L'admin seulement |
| **Associé** | Cofondateurs / concepteurs du produit | Exactement les règles du revendeur (crédit, activations, part) ; seulement listé à part dans l'admin | 80 % | L'admin seulement |

- « Vendeurs » = revendeur + associé (constante `VENDEURS`) : eux seuls ont le crédit et l'activation hors ligne.
- Le taux est réglable par partenaire (1 à 95 %), la monnaie aussi tant qu'aucun mouvement n'existe.
- Un compte a AU PLUS une fiche partenaire (clé = id du compte). Changer de rôle = modifier la fiche, pas en créer une seconde.
- « En pause » (`actif = false`) : plus de lien qui fonctionne, plus de nouvelle commission ni d'activation ; l'historique et les soldes restent. Un compte supprimé met sa fiche en pause.

## 2. Modèle de données

Tables (Supabase : RLS activée, lecture par le propriétaire, écriture UNIQUEMENT par des fonctions SQL `security definer` ou le rôle service ; jamais d'`update` direct du navigateur) :

```text
profiles (existante)  + referrer_id uuid null  -- parrain (fiche partenaire), posé une seule fois
                      + referred_at timestamptz -- début de l'attribution (fenêtre de 12 mois des affiliés)
                      + username text unique (insensible à la casse) -- = le lien de parrainage
orders (existante)    + partner_id uuid null    -- partenaire crédité pour cette commande (rapports admin)

partners          user_id PK, type ('associe'|'revendeur'|'affilie'), code unique (ancien format de lien, gardé valable),
                  rate int (1..95), active bool, currency ('XAF'|'EUR'|'USD'), note, created_at
partner_ledger    id, user_id, balance ('credit'|'earnings'), amount bigint (signé, unités entières),
                  reason, detail, order_id null, license_id null, client_id null,
                  available_on date (date à partir de laquelle un gain est retirable), actor, created_at
                  UNIQUE (order_id, reason) WHERE order_id IS NOT NULL   -- jamais deux commissions pour une commande
link_visits       (user_id, day, visitor_hash) PK                         -- 1 visite par visiteur et par jour
payout_requests   id, user_id, amount, currency, method ('mobile_money'|'virement'), payout_details,
                  status ('demande'|'paye'|'refuse'), created_at, processed_at, reference, note
```

Règles d'or du grand livre (`partner_ledger`) :
- **Un solde n'est JAMAIS une colonne** : c'est toujours la somme de ses lignes. Rien ne se modifie après coup ; une erreur se corrige par une ligne inverse (« correction », « annulation »).
- **Deux soldes** par partenaire : `credit` (prépayé, sert à activer, vendeurs seulement) et `earnings` (gains, retirables).
- **Montants en unités entières** de la monnaie du partenaire (FCFA ; centimes d'euro ; cents de dollar) : aucun flottant, aucun arrondi qui s'accumule.
- **Monnaie du partenaire** = celle de sa zone de prix (FCFA en Afrique, euro en Europe, dollar ailleurs). Les totaux de l'admin sont reconvertis dans la monnaie d'encaissement.
- Motifs (`reason`) : `commission`, `recharge`, `activation`, `retrait`, `retrait_refuse`, `conversion`, `credit_admin`, `annulation`, `remboursement_activation`, `correction` ; chacun a un libellé lisible pour l'historique.
- Gains disponibles = gains − (lignes positives dont `available_on` > aujourd'hui).

## 3. Lien de parrainage et attribution

- **Le lien = `<domaine>/<nom d'utilisateur>`** (ex. `kappgen.com/marie`). Le nom d'utilisateur est choisi par la personne dans Mon compte (bouton « Modifier » à côté du lien, vérification en direct « Disponible / Déjà pris », proposition du suivant libre : `marie2`, `marie3`…). S'il n'en a pas, on lui en donne un automatiquement à partir de son nom.
  - Format : `[a-z0-9][a-z0-9._-]{2,29}`, minuscules, accents retirés.
  - **Liste de noms réservés** : toutes les pages du site et de l'application (`admin`, `api`, `login`, `signup`, `dashboard`, `pricing`, `blog`, `support`, `r`, `robots.txt`, `sitemap.xml`, pages légales, nom du produit…). À compléter à CHAQUE nouvelle page publique, sinon un partenaire peut « voler » une adresse.
  - Changer de nom casse l'ancien lien : le dire dans l'interface. L'ancien `code` interne reste accepté pour les liens déjà partagés.
- **Routage** : une adresse `/<nom>` qui n'est ni un fichier ni une page → redirection vers `/r/<nom>` (Next.js : `middleware.ts` ou route `app/[username]/route.ts` après les routes connues ; site statique séparé : règle du serveur web, ex. nginx `try_files $uri $uri/ @parrain` puis `rewrite ^/([a-z0-9][a-z0-9._-]{2,29})/?$ https://app.<domaine>/r/$1`).
- **`/r/<nom>`** : si le partenaire existe ET est actif → note une visite (empreinte `sha256(ip + user-agent)`, jamais l'adresse IP en clair), pose le cookie `<produit>_parrain=<code>` (**HttpOnly, SameSite=Lax, Secure, 60 jours**) puis redirige vers la page de vente. Partenaire inconnu ou en pause : redirection simple, pas de cookie. `/signup?r=<nom>` a le même effet.
- **Rattachement à l'inscription** (formulaire, Google, inscription depuis le logiciel installé : TOUS les chemins de création de compte) : `UPDATE profiles SET referrer_id=…, referred_at=now() WHERE id=<nouveau> AND referrer_id IS NULL`.
  - **Premier parrain gagne, pour toujours** : un compte déjà rattaché ne change jamais de parrain (ni par un autre cookie, ni par une connexion).
  - Un compte EXISTANT qui clique sur un lien n'est pas rattaché (seulement à la création).
  - Jamais soi-même comme parrain.
- **Qui touche** sur un paiement (`partner_for(client)`) : le parrain s'il est actif ; pour un **affilié**, seulement si `referred_at` a moins de 12 mois ; pour un **vendeur**, sans limite.

## 4. Calcul des parts sur chaque paiement (branchement sur l'orchestrateur)

Point d'accroche : JUSTE APRÈS la livraison atomique de la commande (`creditPaidOrder` / `credit_paid_order` du modèle a renvoyé `true` : c'est CET appel qui a livré). Le mieux : faire la commission dans la MÊME fonction SQL que la livraison, ou dans une fonction SQL `partner_after_payment(order_id)` appelée juste après.

```text
after_payment(order):                                  -- appelée une fois par commande confirmée, jamais bloquante
  si order.kind = 'recharge' :                          -- recharge du crédit d'un vendeur, payée en ligne
      ligne (credit, +montant demandé, 'recharge', order_id)   -- index unique : un 2e passage ne fait rien
      fin
  p = partner_for(order.user_id) ; si aucun : fin
  paye = montant encaissé converti dans la monnaie de p (montant en dollars réel s'il existe, sinon taux du jour)
  part = paye * p.rate // 100  (division entière) ; si part <= 0 : fin
  orders.partner_id = p.user_id
  ligne (earnings, +part, 'commission', order_id, client_id, available_on = aujourd'hui + 14 jours)
  -- doublon (webhook + retour client + cron) : l'index unique (order_id, reason) le refuse → on s'arrête sans erreur
```

- **Jamais bloquant** : une erreur de commission est notée dans le journal d'erreurs (`error_logs`, source « partenaires ») mais n'annule JAMAIS la livraison au client.
- **Remboursement / litige** (commande passée en `flagged_reversal` ou équivalent) : pour chaque ligne `commission` ou `recharge` de cette commande, écrire la ligne inverse (`annulation`, montant négatif), avec sa propre clé unique (`order_id + ':' + motif`) pour ne l'annuler qu'une fois. Le solde de gains peut alors devenir négatif : il se rembourse sur les commissions suivantes.
- **Délai de disponibilité** : 14 jours (le temps d'un remboursement). Avant, le gain est visible « en attente » mais pas retirable.
- Les commissions se calculent sur le montant RÉELLEMENT encaissé (pas le prix catalogue), après conversion de devise.

## 5. Vente hors ligne des vendeurs (crédit prépayé)

Le vendeur encaisse son client lui-même (liquide, Mobile Money direct…) puis active la licence depuis son espace :
- **Coût d'une activation** = (100 − taux) % du prix OFFICIEL de sa zone, arrondi au-dessus (à la centaine de FCFA, au centime). La fenêtre d'activation affiche : prix officiel, montant retiré du crédit, crédit restant.
- **Atomique** : sous verrou (ou dans une fonction SQL), revérifier le solde, écrire la ligne `activation` (négative), PUIS livrer. Si la livraison échoue : ligne `remboursement_activation` (le crédit revient). Deux clics rapides ne font jamais passer le crédit sous zéro. **Sans crédit, pas d'activation** : personne ne doit rien à personne.
- Client inconnu : compte créé sans mot de passe utilisable + e-mail « Votre licence est prête, choisissez votre mot de passe » (lien valable 7 jours, qui confirme aussi l'adresse). Client existant : e-mail « Votre licence est activée ». Le client est rattaché au vendeur s'il n'avait pas de parrain.
- Interdit d'activer pour sa propre adresse (il achète la sienne comme tout le monde).
- Renouvellement : la nouvelle période s'ajoute à la fin de la période en cours (même règle qu'un paiement en ligne).
- **Recharge du crédit** : une commande normale de l'orchestrateur (produit `recharge`, montant libre entre un minimum et un maximum, encodé `<monnaie>:<unités>`) ; le crédit est ajouté par `after_payment`. Le crédit ne se périme pas.
- **Conversion** : un vendeur peut passer ses gains DISPONIBLES en crédit (deux lignes : −gains, +crédit) sans attendre un retrait.
- Prix de vente libre, jamais en dessous du prix officiel (règle écrite dans le manuel du partenaire).

## 6. Retraits (manuels)

- Le partenaire demande un retrait : montant ≥ minimum (ex. 10 000 FCFA, 15 €, 15 $), ≤ gains disponibles, moyen (Mobile Money ou virement) + coordonnées (numéro et nom, ou IBAN et titulaire).
- **Le montant est retiré des gains TOUT DE SUITE** (ligne `retrait`, sous verrou) : impossible de demander deux fois le même argent.
- Les administrateurs reçoivent un e-mail ; l'admin paie chez son fournisseur, puis marque « Payé » (référence de l'opération) ou « Refusé » (motif ; ligne `retrait_refuse` : le montant revient). Le partenaire reçoit un e-mail dans les deux cas.
- Une demande ne se traite qu'une fois (`status = 'demande'` vérifié sous verrou).

## 7. Tableau de bord du partenaire (espace client)

Groupe de menu « Gagner avec <Produit> » : page « Parrainage » (affilié ou simple client) ou « Espace revendeur » (vendeurs). Un client sans fiche voit l'offre et le bouton « Obtenir mon lien de parrainage » (compte confirmé exigé).

- **Lien** en grand avec « Copier » et « Modifier » (nom d'utilisateur).
- **Soldes** : gains disponibles, gains en attente (avec la date), crédit (vendeurs). Boutons « Demander un retrait », « Recharger mon crédit », « Passer mes gains en crédit », « Activer une licence » (vendeurs).
- **« Comment votre lien travaille »** : visites (total, visiteurs uniques, 30 derniers jours), inscrits, acheteurs, abonnés actifs, en essai, paiements, licences, argent dépensé par les filleuls, conversion (abonnés / inscrits, inscrits / visiteurs), 6 derniers mois en barres (visites, inscrits, ventes, gains).
- **Mes clients / filleuls** : pour chacun, date d'arrivée, offre et date de fin, abonné ou non, nombre de paiements, montant dépensé, ce qu'il a rapporté ; « Renouveler » pour un vendeur. **Un affilié voit seulement le prénom et l'adresse masquée** (`ma***@gmail.com`) ; un vendeur voit l'adresse complète (il vend en direct).
- **Ce que vous coûte chaque activation** (vendeurs) : coût et prix officiel par offre et par durée.
- **Historique** : chaque ligne du grand livre avec son libellé, retraits et leur statut.
- Tous les montants dans la monnaie du partenaire, formatés (`12 000 FCFA`, `20,50 €`).

## 8. Administration (« Revendeurs et affiliés », « Retraits à payer »)

- **Liste** par type (associés, revendeurs, affiliés) : nom, lien, taux, monnaie, état, nombre de clients, soldes, ventes en ligne, commissions, activations et part de l'éditeur sur les activations. Totaux en monnaie d'encaissement : recharges reçues, crédits ajoutés à la main, part de l'éditeur (activations + ventes en ligne − commissions), commissions, retraits payés, retraits à payer, gains dus, crédit restant.
- **Nommer** un compte (depuis sa fiche utilisateur ou la liste) : type, taux (défaut du type), monnaie. **Modifier**, **Mettre en pause / Reprendre**, **Créditer** (montant + solde + motif ; négatif = correction, refusé si le solde deviendrait négatif) pour du liquide remis en main propre ou un geste commercial.
- **Fiche utilisateur › Partenariat** : son parrain éventuel, sa fiche partenaire, ses mouvements, ses clients.
- **Retraits à payer** : demandes en attente en tête, Payer (référence) / Refuser (motif) ; pastille du nombre en attente dans le menu admin.
- Toutes les actions sont réservées à l'admin principal (`requireAdmin()`) et **journalisées** avec l'acteur (« admin <email> »).

## 9. E-mails

| Quand | Destinataire | Contenu |
|---|---|---|
| L'admin nomme quelqu'un (ou change son type) | Le partenaire | « Bienvenue dans l'équipe <Produit> » : son rôle en une phrase (selon le type), sa part en %, son lien à partager, bouton « Ouvrir mon tableau de bord » (lien direct vers sa page) |
| Activation par un vendeur, client nouveau | Le client | « Votre licence est prête » + bouton « Choisir mon mot de passe » (7 jours) |
| Activation par un vendeur, client existant | Le client | « Votre licence est activée » |
| Recharge du crédit payée | Le vendeur | Reçu habituel de l'orchestrateur, texte adapté (« crédit rechargé ») |
| Demande de retrait | Chaque admin | Nom, montant, moyen, lien vers « Retraits à payer » |
| Retrait payé / refusé | Le partenaire | Montant, référence ou motif, lien vers ses gains |

Ajouter chaque modèle à la page « exemple de chaque e-mail » de l'admin (`references/emails-et-deux-etapes.md`).

## 10. Anti-abus (à garder TOUS)

- **Auto-parrainage** : refusé (parrain = soi-même) ; un vendeur ne peut pas activer pour sa propre adresse. Bonus : comparer l'adresse canonique (points et `+alias` Gmail retirés) du filleul et du parrain.
- **Premier parrain gagne** ; aucun changement de parrain après l'inscription (sauf geste admin journalisé).
- **Lien d'un partenaire en pause** : n'attribue rien.
- **Commission unique par commande** (index unique) ; **annulée au remboursement** ; **disponible après 14 jours seulement**.
- **Affiliés limités dans le temps** (12 mois) ; taux bornés (1 à 95 %).
- **Retraits** : minimum, plafond = gains disponibles, montant réservé immédiatement, limite de débit (5 demandes / jour / compte), paiement manuel par un humain.
- **Activations** : limite de débit (60 / heure / vendeur), solde revérifié sous verrou, compte confirmé exigé pour devenir affilié ou recharger.
- **Recharges** : montant entre un minimum et un maximum, mêmes protections que tout paiement (identité depuis la session, montant calculé côté serveur).
- **Visites** : empreinte non réversible, une par visiteur et par jour (le compteur ne se gonfle pas en rechargeant).
- **Noms réservés** : impossible de prendre l'adresse d'une page du site.
- **Vie privée** : un affilié ne voit jamais l'adresse complète de ses filleuls.
- Monnaie non modifiable dès qu'il y a des mouvements.

## 11. Points d'attention (erreurs déjà vues)

- Brancher le rattachement sur **TOUS** les chemins d'inscription (formulaire, Google, appli installée, invitation) : en oublier un = des filleuls perdus.
- Le cookie doit être posé par le domaine de l'APPLICATION (là où se crée le compte) : si la vitrine est sur un autre domaine, la faire rediriger vers `app.<domaine>/r/<nom>`.
- Ajouter toute nouvelle page publique à la liste des noms réservés.
- Un changement de taux par défaut ne change pas les fiches existantes : migration explicite et unique (marqueur dans les réglages) si l'éditeur veut appliquer le nouveau taux aux partenaires restés à l'ancien.
- Ne jamais stocker un solde ; recalculer à partir du grand livre (index `(user_id, id)`).
- Les commissions ne bloquent jamais la livraison ; les erreurs vont dans le journal d'erreurs, visibles sur la page Santé.
- Traduire tous les textes du tableau de bord partenaire et des e-mails dans chaque langue du produit.
- Documenter le programme pour les clients (manuel : « Gagner de l'argent avec <Produit> » : parrainage, revente, gains et retraits) et dans les conditions d'utilisation (taux, durée, délai, retraits, droit de mettre fin).

## 12. Tests à écrire

- Inscription par un lien → rattaché ; deuxième lien → parrain inchangé ; compte existant → non rattaché ; lien d'un partenaire en pause → rien.
- Paiement d'un filleul → une commission exacte (arrondi entier) ; même paiement confirmé deux fois (webhook + retour + cron) → une seule commission.
- Affilié après 12 mois → plus de commission ; vendeur → toujours.
- Remboursement → commission annulée une fois.
- Retrait : au-dessus des gains disponibles refusé ; gain de moins de 14 jours non retirable ; refus → montant rendu.
- Activation hors ligne : crédit insuffisant refusé ; deux activations simultanées ne passent jamais sous zéro ; échec de livraison → crédit rendu.
- Nom d'utilisateur : réservé refusé, déjà pris → suggestion libre.
- RLS : un partenaire ne lit ni les mouvements ni les filleuls d'un autre ; un client ne peut pas écrire dans `partners` ni `partner_ledger`.
