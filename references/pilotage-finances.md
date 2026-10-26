# Pilotage et finances : revenus, charges, marge réelle

Appris sur iziVoice (20 au 25/10/2026, page Administration › Revenus). Le tableau de bord montrait un chiffre d'affaires ;
le créateur voulait savoir « ce que l'on gagne réellement après avoir vendu au cours d'un mois ». Porté dans le modèle :
`/admin/revenus`.

## Pourquoi
- Un chiffre d'affaires seul ment : frais de paiement (8 à 10 % selon le canal), fournisseurs payés à l'usage, abonnements,
  dépenses imprévues, crédits offerts. Sans eux, un mois « record » peut être à perte.
- L'argent qui n'est pas passé par la passerelle (espèces, collaboration à prix réduit, don) disparaissait des comptes, ou
  pire, gonflait le solde des clients sans trace du motif.

## Comment (dans le modèle)
- **Revenus par période** : raccourcis (aujourd'hui, semaine, mois, mois dernier, 30 j, 3 mois, année, 12 mois) + du/au, regroupement
  heure / jour / semaine / mois / année (l'heure n'est proposée que jusqu'à 7 jours, sinon trop de barres). Chaque tranche existe même
  sans vente (pas de trou dans le graphique). Comparaison avec la période précédente de même longueur.
- **Liste des ventes avec leur heure** à l'heure de la plateforme (`site.timezone`), jamais celle du navigateur.
- **Part et évolution par canal** (moyen de paiement) et par offre : part du CA en %, évolution face à la période d'avant, « nouveau »
  si le canal n'existait pas avant.
- **Chiffres clés** : aujourd'hui / hier, 7 jours, mois à date comparé au même jour du mois d'avant (jamais un mois entier contre un
  mois commencé), projection fin de mois, panier moyen, nouveaux clients, taux de réachat, valeur d'un client.
- **Charges en trois familles**, réglées séparément :
  1. fixes : abonnements mensuels ou annuels (un annuel = 1/12 par mois), part imputée (dépense partagée : 20 %), début / fin,
     « gratuit pour le moment » (affiché gratuit, pas « à renseigner ») ;
  2. variables : fournisseurs à l'usage + frais de paiement (% par canal, `*` = taux par défaut) ;
  3. ponctuelles : une dépense datée.
  Une charge mensuelle est ramenée à la période au prorata des jours (une semaine ≈ 7/30).
- **Coût des fournisseurs CALCULÉ, jamais saisi** : le code note l'usage réel à chaque appel réussi
  (`recordProviderUsage(db, { provider, service, units, userId, ref })`), la page multiplie par le tarif en vigueur le jour de
  l'appel. Un usage sans tarif est signalé en rouge (sinon il compterait pour zéro en silence).
- **Tarifs datés** : changer un prix = ajouter une version « à partir du … ». Les jours d'avant gardent l'ancien tarif : la marge
  d'un mois passé ne change jamais quand on met un prix à jour. Idem pour les frais de paiement.
- **Mouvements hors passerelle avec motif** : vente manuelle, collaboration, don, correction (entrées) ; remboursement, reprise d'un
  don, fin de collaboration, autre retrait (retraits). Chacun garde l'encaissé (dans sa devise + en FCFA) et la **valeur au prix du
  site** au moment de l'ajout (calculée d'après les packs de crédits si on ne la donne pas) : manque à gagner = prix du site − encaissé.
  Option « verser / reprendre ces crédits sur le compte » dans le même geste (ligne `admin_adjustment` du registre).
- **Marge réelle** = ventes + encaissé hors passerelle − remboursements − (frais + fournisseurs + fixes + ponctuelles).
- **Devise de l'administration** : tout est stocké et calculé en FCFA, affiché dans la devise choisie (FCFA, €, $), réglage commun à
  tous les admins (`system_settings.admin_currency`), taux de `exchange_rates`.

## Pièges appris sur iziVoice
- **Le champ « facture réelle du mois » a faussé la marge** : 5 $ saisis en pensant « 5 $ le million » ont remplacé 120 $ calculés
  (24 M de caractères). Le champ a été retiré : le coût d'un fournisseur se calcule, point. Et un prix porte TOUJOURS son unité
  (« 5 $ pour 1 000 000 caractères »), avec un aperçu en clair avant d'enregistrer.
- Changer un tarif réécrivait l'historique (les mois passés recalculés au nouveau prix) : d'où les versions datées.
- Comparer « ce mois » au mois dernier COMPLET donnait −60 % tous les débuts de mois : comparer à la même date.
- Jours calculés en UTC : les ventes de 23 h 30 tombaient le lendemain. Tout passer par le fuseau de la plateforme, y compris le
  découpage des requêtes (`dayStartIso`).
- Les anciens ajouts manuels n'avaient pas de prix du site : le noter AU MOMENT de l'ajout (les prix changent).
- Les commandes de test ne comptent jamais ; les comptes internes non plus si le projet en a.
- Un taux de frais « moyen réel » s'affiche quand le taux a changé pendant la période (pas le dernier taux appliqué à tout).
- Les listes qui grandissent sont lues par pages de 1 000 avec un plafond, et la page dit quand le plafond est atteint.
- Ne jamais saisir de chiffre réel dans le code (montants des abonnements, prix des fournisseurs) : tout est en base, réglé dans la page.

## Fichiers du modèle
- `supabase/migrations/20261026100000_pilotage_finances.sql` : `finance_charges`, `provider_rates`, `payment_fee_rates`,
  `provider_usage`, `money_adjustments` (RLS, lecture admin, écriture serveur).
- `src/lib/finance/` : `money.ts` (devises, format), `charges.ts` (familles, prorata, tarifs datés), `adjustments.ts` (motifs),
  `period.ts`, `schemas.ts` (zod), `server.ts` (taux, devise, `recordProviderUsage`, coût des fournisseurs), `revenue.ts` (le calcul).
- `src/app/api/admin/finance/` : `revenue`, `charges` (+ `[id]`), `adjustments` (+ `[id]`), `currency`.
- `src/app/admin/revenus/` : page, graphique maison, marge et réglages des charges, mouvements hors passerelle.
- `src/components/admin/AdminCurrency.tsx` : `AdminCurrencyProvider`, `useAdminCurrency().format`, `AdminCurrencySwitcher`.
  Pour tout l'admin : envelopper le contenu de `src/app/admin/layout.tsx` dans le fournisseur.
