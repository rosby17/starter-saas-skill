// Motifs des mouvements d'argent hors passerelle (table money_adjustments). Chaque ajout manuel de crédits ou d'accès
// dit POURQUOI : une vente encaissée à la main, une collaboration à prix réduit, un don gratuit… et chaque retrait aussi.
// La page Revenus en tire l'encaissé hors passerelle, le manque à gagner (valeur au prix du site − encaissé) et
// « qui a reçu quoi ». Fichier sans import serveur.

export type AdjustmentReason =
  | 'vente_manuelle' | 'collaboration' | 'don' | 'correction'
  | 'remboursement' | 'reprise_don' | 'fin_collaboration' | 'autre_retrait'

export const ADJUSTMENT_REASONS: {
  value: AdjustmentReason; label: string; hint: string
  /** entrée = crédits / accès donnés ; retrait = repris ou rendus. */
  direction: 'entree' | 'retrait'
  /** L'encaissé compte dans le chiffre d'affaires (+) ou en sort (−). */
  money: 'in' | 'out' | 'none'
}[] = [
  { value: 'vente_manuelle', label: 'Vente manuelle', hint: 'Payé hors du site (espèces, dépôt direct) au prix du site ou presque', direction: 'entree', money: 'in' },
  { value: 'collaboration', label: 'Collaboration', hint: 'Prix réduit accordé à un partenaire, un créateur, un revendeur', direction: 'entree', money: 'in' },
  { value: 'don', label: 'Don', hint: 'Offert : rien d’encaissé, tout compte en manque à gagner', direction: 'entree', money: 'none' },
  { value: 'correction', label: 'Correction', hint: 'Rendre ce qu’une panne a fait perdre : ni encaissé, ni manque à gagner', direction: 'entree', money: 'none' },
  { value: 'remboursement', label: 'Remboursement', hint: 'Argent rendu à un client : sort du chiffre d’affaires', direction: 'retrait', money: 'out' },
  { value: 'reprise_don', label: 'Reprise d’un don', hint: 'Crédits offerts repris', direction: 'retrait', money: 'none' },
  { value: 'fin_collaboration', label: 'Fin de collaboration', hint: 'Fin d’un accord partenaire', direction: 'retrait', money: 'none' },
  { value: 'autre_retrait', label: 'Autre retrait', hint: 'Erreur de saisie, abus…', direction: 'retrait', money: 'none' },
]

export const reasonInfo = (reason: string) => ADJUSTMENT_REASONS.find((r) => r.value === reason)
export const isAdjustmentReason = (v: unknown): v is AdjustmentReason => ADJUSTMENT_REASONS.some((r) => r.value === v)

/** Motifs dont la remise compte en manque à gagner (la correction ne coûte rien : elle répare). */
export const DISCOUNT_REASONS: AdjustmentReason[] = ['vente_manuelle', 'collaboration', 'don']
