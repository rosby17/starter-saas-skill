# Tarification par pays et engagement prépayé

Appris sur iziVoice le 13/10/2026 (SaaS à crédits, paiement Mobile Money + carte). Deux leviers de revenu, réutilisables sur tout SaaS à crédits ou à packs.

## 1. Prix selon le pouvoir d'achat du pays

**Principe :** un prix de base (calibré pour le marché d'origine, ex. Afrique francophone) × un coefficient par pays. Les paliers suivent le PIB/habitant en parité de pouvoir d'achat, pas les zones monétaires.

| Palier | Coefficient | Exemples |
|---|---|---|
| Base | ×1 | Afrique, pays à faible revenu |
| Intermédiaire inférieur | ×1,2 | Inde, Indonésie, Vietnam, Afrique du Sud |
| Intermédiaire | ×1,3 | Brésil, Mexique, Thaïlande, Balkans |
| Intermédiaire supérieur | ×1,5 | Pologne, Grèce, Chine, Turquie (+ pays non listés) |
| Revenu élevé | ×1,8 | Italie, Espagne, Japon, Corée |
| Haut revenu | ×2,2 | France, Allemagne, Royaume-Uni, Canada, Australie |
| Très haut revenu | ×2,5 | États-Unis, Suisse, Norvège, Singapour, Émirats |

**Règles qui comptent :**
- **Les clients existants gardent leurs prix** : coefficient 1 pour tout compte créé avant la date de lancement, et même liste de devises qu'avant (ne pas faire passer un ancien client de $ à €). La date de référence est `auth.users.created_at`, que le client ne peut pas modifier, jamais un champ du profil.
- **Pays = celui de l'IP** (en-tête Cloudflare `cf-ipcountry`), le même qui choisit déjà la devise. Pays inconnu → coefficient 1 (on ne pénalise personne).
- **Un seul calcul, côté serveur, deux usages** : l'API de géolocalisation renvoie le coefficient pour l'affichage, et le checkout le RECALCULE pour plafonner les crédits et vérifier le prix. Sinon un client paie le prix africain depuis les États-Unis et obtient les mêmes crédits.
- Côté client, deux taux séparés : `priceRate = taux de change × coefficient` (prix affiché) et le vrai taux de change (montant USD envoyé aux passerelles qui facturent en USD).
- Ne pas l'annoncer publiquement (« les prix varient selon le pays ») : ça n'attire que l'attention de ceux qui paient plus.

## 2. Engagement prépayé (payer plusieurs mois d'avance)

Le Mobile Money ne sait pas prélever chaque mois : on vend donc **un paiement unique** pour plusieurs mois, plutôt qu'un abonnement.

**Deux forces opposées, à ne jamais mélanger :**
- **Remise de volume** : payer d'avance 3 / 6 / 12 mois → −10 / −20 / −30 %.
- **Majoration de conservation** : plus les crédits durent, plus c'est cher (3 mois +10 %, 6 mois +20 %, 1 an +25 %, à vie +30 %).

**Trois façons de recevoir N mois de crédits :**

| Mode | Réception | Conservation | Prix (Standard 1 M/mois, 12 mois, base 17 500) |
|---|---|---|---|
| Chaque mois, remis à zéro | 1 pack / mois, perdu en fin de mois | ×1 | 147 000 (−30 %) |
| Chaque mois, cumulable | 1 pack / mois, tout valable jusqu'à la fin | moitié de la majoration | 165 500 (−21 %) |
| Tout d'un coup | N packs immédiatement, valables N mois | majoration complète | 184 000 (−12 %) |

Prix = prix mensuel (pays inclus) × N × (1 − remise) × majoration. Ordre toujours respecté : remis à zéro < cumulable < d'un coup < N achats séparés.

**Interface (validée par le propriétaire) :**
- « Payer pour : Mensuel · 3 mois · 6 mois · Annuel » avec les remises en vert.
- En Mensuel : le choix de conservation habituel, majorations en orange. Au-delà : « Comment recevoir » à la place. Ne jamais afficher les deux à la fois : « 3 mois d'avance + à vie » n'a pas de sens.
- Même présentation pour les deux choix : bandeau explicatif (⚠️) + rangée de pastilles colorée quand sélectionnée. Sur mobile, une seule barre, libellé au-dessus et pourcentage dessous (pas de grille ni de bulle).
- Packs fixes uniquement, non cumulable avec un code promo, non remboursable.

**Architecture qui évite de toucher aux N chemins de paiement :**
- Le 1er versement passe par le circuit existant (le cycle du 1er pot donne la bonne validité ; « d'un coup » = commande ordinaire de N packs).
- Colonnes `orders.commitment_*` + un **trigger** sur le passage de la commande à `success` qui ouvre une ligne `credit_commitments` : marche quel que soit le prestataire (webhook, vérification, admin).
- Un cron horaire appelle une fonction SQL `deliver_commitment_refill(id)` : verrou de ligne (`FOR UPDATE`), aucun double versement, rattrapage des retards, plus rien si la commande n'est plus `success`. En mode cumulable, une date d'expiration commune (`pots_expire_at`).
- Le checkout recalcule le prix attendu (même enchaînement d'arrondis que l'affichage) et refuse un montant trop bas (5 % de dérive de change tolérée).
- Tester la migration sur un vrai Postgres sans Docker : `@electric-sql/pglite` (11 vérifications : ouverture, doublon, date, rattrapage, remboursement, droits).

**Pièges rencontrés :**
- `{n}` présent deux fois dans un texte traduit : utiliser `replaceAll`, pas `replace`.
- Sur Supabase auto-hébergé, une migration qui modifie une table existante doit tourner en `supabase_admin` (le rôle `postgres` n'en est pas propriétaire).
- La tâche planifiée qui appelle l'app dans son conteneur Alpine : `http://127.0.0.1:3000`, jamais `localhost` (IPv6), et `wget` (pas de `curl` dans l'image).
