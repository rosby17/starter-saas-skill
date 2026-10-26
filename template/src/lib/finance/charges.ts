import { toFcfa, type Currency, type FcfaPer } from './money'

// Charges du pilotage financier, en TROIS familles (affichées et réglées séparément) :
//  1. fixes      : abonnements (serveur, nom de domaine, outils…), mensuels ou annuels (un annuel est réparti sur 12 mois),
//                  avec une part imputée au produit (dépense partagée) et une période de validité ;
//  2. variables  : fournisseurs payés à l'usage (coût CALCULÉ d'après provider_usage × tarif daté, jamais une facture
//                  saisie à la main) et frais de paiement (% de chaque vente, daté lui aussi) ;
//  3. ponctuelles: dépenses imprévues, datées.
// Fichier sans import serveur : la page l'utilise aussi pour ses aperçus.

export type ChargeRow = {
  id: string; label: string; family: 'fixe' | 'ponctuelle'
  amount: number; currency: Currency; period: 'monthly' | 'yearly' | 'once'
  share_pct: number; free: boolean; starts_on: string | null; ends_on: string | null; note: string | null
}
export type ProviderRateRow = {
  id: string; provider: string; service: string; label: string | null
  amount: number; currency: Currency; per_units: number; unit: string; valid_from: string; note: string | null
}
export type FeeRateRow = { id: string; method: string; percent: number; valid_from: string }

export type ChargeLine = {
  id: string; label: string; family: 'fixe' | 'variable' | 'ponctuelle' | 'frais'; fcfa: number
  /** Fixes : montant non renseigné (ni montant, ni « gratuit »). */
  missing?: boolean
  free?: boolean
  /** Variables : volume consommé sur la période et son unité. */
  units?: number; unit?: string
  /** Variables : aucun tarif en vigueur pour une partie de l'usage (coût sous-estimé). */
  unpriced?: number
  /** Frais : chiffre d'affaires concerné et taux moyen réel. */
  revenue?: number; rate?: number; count?: number
}

const DAY_MS = 86_400_000
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
export const addDays = (day: string, n: number) => new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1
const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()

/**
 * Part de chaque mois couverte par [from, to] (jours inclus) : un mois entier = 1, la moitié d'un mois = 0,5.
 * Les charges mensuelles sont ramenées à la période avec ces parts (une semaine ≈ 7/30 de l'abonnement).
 */
export function monthShares(from: string, to: string): { month: string; first: string; last: string; share: number }[] {
  const out: { month: string; first: string; last: string; share: number }[] = []
  let cursor = from.slice(0, 7)
  const lastMonth = to.slice(0, 7)
  while (cursor <= lastMonth) {
    const total = daysInMonth(cursor)
    const first = cursor === from.slice(0, 7) ? from : `${cursor}-01`
    const last = cursor === lastMonth ? to : `${cursor}-${String(total).padStart(2, '0')}`
    out.push({ month: cursor, first, last, share: Math.max(0, daysBetween(first, last)) / total })
    cursor = new Date(Date.UTC(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)), 1)).toISOString().slice(0, 7)
  }
  return out
}

/** Jours de [a1, a2] ∩ [b1, b2] (0 si disjoints). */
const overlapDays = (a1: string, a2: string, b1: string, b2: string) => {
  const start = a1 > b1 ? a1 : b1
  const end = a2 < b2 ? a2 : b2
  return end < start ? 0 : daysBetween(start, end)
}

/** Charges fixes et ponctuelles de la période, en FCFA, une ligne par charge. */
export function fixedAndOneOffCharges(charges: ChargeRow[], from: string, to: string, rates: FcfaPer): ChargeLine[] {
  const lines: ChargeLine[] = []
  for (const c of charges) {
    if (c.family === 'ponctuelle') {
      if (!c.starts_on || c.starts_on < from || c.starts_on > to) continue
      lines.push({ id: c.id, label: c.label, family: 'ponctuelle', fcfa: toFcfa(c.amount, c.currency, rates) * (c.share_pct / 100) })
      continue
    }
    const share = Math.min(100, Math.max(0, Number(c.share_pct ?? 100))) / 100
    const monthly = (toFcfa(c.amount, c.currency, rates) / (c.period === 'yearly' ? 12 : 1)) * share
    let fcfa = 0
    let covered = false
    for (const m of monthShares(from, to)) {
      // Jours du mois où la charge court (début / fin de l'abonnement).
      const days = overlapDays(m.first, m.last, c.starts_on ?? '0000-01-01', c.ends_on ?? '9999-12-31')
      if (!days) continue
      covered = true
      fcfa += monthly * (days / daysInMonth(m.month))
    }
    if (!covered) continue
    lines.push({ id: c.id, label: c.label, family: 'fixe', fcfa, free: c.free && !c.amount, missing: !c.amount && !c.free })
  }
  return lines
}

/** Clé de regroupement d'un moyen de paiement (casse et espaces ignorées). */
export const methodKey = (method: string | null | undefined) => (method || '').trim().toLowerCase() || 'autre'
export const methodLabel = (method: string | null | undefined) => (method || '').trim() || 'Autre'

/** Taux de frais (en %) d'un moyen de paiement à une date : sa dernière version datée, sinon le taux par défaut « * ». */
export function feeRateAt(rows: FeeRateRow[], method: string | null | undefined, day: string): number {
  const pick = (key: string) => rows
    .filter((r) => methodKey(r.method) === key && r.valid_from <= day)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]
  const own = pick(methodKey(method))
  if (own) return Number(own.percent) || 0
  return Number(pick('*')?.percent) || 0
}

/** Tarif d'un fournisseur en vigueur à une date : le service précis d'abord, sinon le tarif général du fournisseur. */
export function providerRateAt(rows: ProviderRateRow[], provider: string, service: string, day: string): ProviderRateRow | null {
  const pick = (svc: string) => rows
    .filter((r) => r.provider === provider && r.service === svc && r.valid_from <= day)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]
  return (service && pick(service)) || pick('') || null
}

/** Coût en FCFA d'un volume au tarif donné (« 5 USD pour 1 000 000 unités »). */
export const unitsCostFcfa = (units: number, rate: Pick<ProviderRateRow, 'amount' | 'currency' | 'per_units'>, rates: FcfaPer) =>
  (units / (Number(rate.per_units) || 1)) * toFcfa(rate.amount, rate.currency, rates)

/** Libellé lisible d'un tarif : « 5 $ pour 1 000 000 caractères ». */
export function rateLabel(rate: Pick<ProviderRateRow, 'amount' | 'currency' | 'per_units' | 'unit'>): string {
  const symbol = rate.currency === 'XAF' ? 'FCFA' : rate.currency === 'EUR' ? '€' : '$'
  return `${Number(rate.amount).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} ${symbol} pour ${Number(rate.per_units).toLocaleString('fr-FR')} ${rate.unit}`
}
