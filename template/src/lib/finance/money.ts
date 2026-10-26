// Devises du pilotage financier : tout est CALCULÉ en FCFA (les passerelles facturent en FCFA et orders.amount_fcfa
// est la référence), puis AFFICHÉ dans la devise de l'administration (réglage partagé par tous les admins).
// Fichier sans import serveur : utilisable dans le navigateur comme sur le serveur.

export type Currency = 'XAF' | 'EUR' | 'USD'
export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'XAF', label: 'Franc CFA (FCFA)', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'USD', label: 'Dollar américain ($)', symbol: '$' },
]
export const isCurrency = (v: unknown): v is Currency => v === 'XAF' || v === 'EUR' || v === 'USD'

/** Combien de FCFA vaut une unité de chaque devise. Valeurs de secours si exchange_rates est vide. */
export type FcfaPer = Record<Currency, number>
export const FALLBACK_FCFA_PER: FcfaPer = { XAF: 1, EUR: 655.957, USD: 610 }

export const toFcfa = (amount: number, currency: Currency, rates: FcfaPer = FALLBACK_FCFA_PER) =>
  (Number(amount) || 0) * (rates[currency] ?? 1)
export const fromFcfa = (fcfa: number, currency: Currency, rates: FcfaPer = FALLBACK_FCFA_PER) =>
  (Number(fcfa) || 0) / (rates[currency] || 1)

/** « 12 500 FCFA », « 19,06 € », « 20,49 $ » (espace insécable fine remplacée par une espace simple). */
export function formatMoney(fcfa: number, currency: Currency, rates: FcfaPer = FALLBACK_FCFA_PER): string {
  const value = fromFcfa(fcfa, currency, rates)
  const digits = currency === 'XAF' ? 0 : Math.abs(value) >= 1000 ? 0 : 2
  const n = value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/ | /g, ' ')
  return currency === 'XAF' ? `${n} FCFA` : `${n} ${currency === 'EUR' ? '€' : '$'}`
}

/** Version courte pour les axes de graphique : 12,5 k, 1,2 M. */
export function compactMoney(fcfa: number, currency: Currency, rates: FcfaPer = FALLBACK_FCFA_PER): string {
  const v = fromFcfa(fcfa, currency, rates)
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`
  return Math.round(v).toLocaleString('fr-FR')
}

/** Clé du réglage dans system_settings. */
export const ADMIN_CURRENCY_KEY = 'admin_currency'
