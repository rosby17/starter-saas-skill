// PRIX SELON LA ZONE DU VISITEUR : une seule règle, partagée par l'affichage (navigateur) et le paiement (serveur).
//
// Les prix sont saisis en FCFA dans /admin/products : c'est le prix de l'Afrique, de l'Asie et du reste du monde.
// Barème par zone : le prix FCFA est CONVERTI, puis multiplié selon la zone :
//   - Europe : en euros (1 € = 655,957 FCFA) × 1,5 ;
//   - Amériques (Nord, Centre, Sud et Caraïbes) : en dollars (1 $ ≈ 600 FCFA) × 2 ;
//   - Afrique, Asie et reste du monde : même prix (FCFA, ou converti en dollars hors zone CFA).
// Changer un coefficient : modifier ZONE_FACTOR ci-dessous, rien d'autre.

export type PriceZone = 'base' | 'europe' | 'amerique'
export type DisplayCurrency = 'XAF' | 'XOF' | 'EUR' | 'USD'

const ZONE_FACTOR = { europe: 1.5, amerique: 2 } as const
const FCFA_PER_EUR = 655.957
/** Taux d'affichage du dollar (Amériques, et zone « base » hors zone CFA : Asie, Maghreb…). */
export const FCFA_PER_USD = 600

const EUROPE = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB', 'CH', 'NO', 'IS', 'LI', 'AD', 'MC', 'SM', 'VA',
])
// Tout le continent américain (Amérique latine comprise).
const AMERIQUES = new Set([
  'US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA',
  'CU', 'DO', 'HT', 'JM', 'PR', 'TT', 'BS', 'BB', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC',
  'CO', 'VE', 'EC', 'PE', 'BO', 'BR', 'PY', 'UY', 'AR', 'CL', 'GY', 'SR', 'GF',
])
// Zone CFA (et voisins qui payaient déjà en FCFA sur l'ancien site) : prix affiché en FCFA.
const CEMAC = new Set(['CM', 'CF', 'CG', 'TD', 'GQ', 'GA', 'CD', 'MG', 'KM', 'GN', 'BI', 'RW'])
const UEMOA = new Set(['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'])

export function zoneForCountry(country: string | null | undefined): PriceZone {
  const cc = (country || '').toUpperCase()
  if (EUROPE.has(cc)) return 'europe'
  if (AMERIQUES.has(cc)) return 'amerique'
  return 'base'
}

/** Devise d'affichage : FCFA en zone CFA, euro en Europe, dollar ailleurs. */
export function currencyForCountry(country: string | null | undefined): DisplayCurrency {
  const cc = (country || '').toUpperCase()
  if (EUROPE.has(cc)) return 'EUR'
  if (UEMOA.has(cc)) return 'XOF'
  if (CEMAC.has(cc) || !cc) return 'XAF'
  return 'USD'
}

// Prix ronds : 199,50 → 200 ; 8,90 → 8,99 ; 19,90 → 19,99.
function roundPrice(x: number): number {
  return x >= 100 ? Math.round(x) : Math.ceil(x) - 0.01
}


/**
 * Prix à afficher ET à payer pour un prix catalogue en FCFA.
 * Zone « base » : le prix FCFA, simplement converti si le visiteur est hors zone CFA.
 */
export function regionalPrice(fcfa: number, country: string | null | undefined): { amount: number; currency: DisplayCurrency } {
  const zone = zoneForCountry(country)
  if (zone === 'europe') return { amount: roundPrice((fcfa / FCFA_PER_EUR) * ZONE_FACTOR.europe), currency: 'EUR' }
  if (zone === 'amerique') return { amount: roundPrice((fcfa / FCFA_PER_USD) * ZONE_FACTOR.amerique), currency: 'USD' }
  const currency = currencyForCountry(country)
  if (currency === 'USD') return { amount: Math.floor(fcfa / FCFA_PER_USD) + 0.99, currency }
  return { amount: fcfa, currency }
}

const SYMBOLS: Record<DisplayCurrency, string> = { XAF: 'FCFA', XOF: 'FCFA', EUR: '€', USD: '$' }

export function formatAmount(amount: number, currency: DisplayCurrency): string {
  const value = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 })
    .format(amount)
    .replace(/[  ]/g, ' ')
  return `${value} ${SYMBOLS[currency]}`
}

/** Montant d'une commande dans sa devise (anciennes commandes : FCFA). */
export function formatOrderAmount(amount: number | string | null | undefined, currency: string | null | undefined): string {
  const cur = (currency || 'XOF').toUpperCase()
  const known: DisplayCurrency = cur === 'EUR' ? 'EUR' : cur === 'USD' ? 'USD' : 'XOF'
  return formatAmount(Number(amount ?? 0), known)
}

// ÉQUIVALENT EN DEVISE LOCALE (affichage seulement) : les passerelles encaissent en FCFA, euro ou dollar ; pour les pays
// qui ont une autre monnaie (Inde, Royaume-Uni, Nigeria…), on montre en plus un ordre de grandeur « ≈ » dans leur devise.
// Taux indicatifs (unités pour 1 $), à revoir de temps en temps : ce n'est jamais le montant prélevé.
const LOCAL: Record<string, { code: string; symbol: string; perUsd: number }> = {
  IN: { code: 'INR', symbol: '₹', perUsd: 83 }, GB: { code: 'GBP', symbol: '£', perUsd: 0.79 }, NG: { code: 'NGN', symbol: '₦', perUsd: 1500 },
  GH: { code: 'GHS', symbol: 'GH₵', perUsd: 15 }, MA: { code: 'MAD', symbol: 'DH', perUsd: 10 }, DZ: { code: 'DZD', symbol: 'DA', perUsd: 135 },
  TN: { code: 'TND', symbol: 'DT', perUsd: 3.1 }, KE: { code: 'KES', symbol: 'KSh', perUsd: 130 }, ZA: { code: 'ZAR', symbol: 'R', perUsd: 18.5 },
  CH: { code: 'CHF', symbol: 'CHF', perUsd: 0.88 }, CA: { code: 'CAD', symbol: 'CA$', perUsd: 1.37 }, CN: { code: 'CNY', symbol: '¥', perUsd: 7.2 },
  AE: { code: 'AED', symbol: 'AED', perUsd: 3.67 }, BR: { code: 'BRL', symbol: 'R$', perUsd: 5.4 }, MX: { code: 'MXN', symbol: 'MX$', perUsd: 18 },
  CD: { code: 'CDF', symbol: 'FC', perUsd: 2800 }, GN: { code: 'GNF', symbol: 'FG', perUsd: 8600 }, MG: { code: 'MGA', symbol: 'Ar', perUsd: 4500 },
  RW: { code: 'RWF', symbol: 'FRw', perUsd: 1350 }, BI: { code: 'BIF', symbol: 'FBu', perUsd: 2900 }, KM: { code: 'KMF', symbol: 'FC', perUsd: 455 },
  HT: { code: 'HTG', symbol: 'G', perUsd: 132 }, EG: { code: 'EGP', symbol: 'E£', perUsd: 48 }, TR: { code: 'TRY', symbol: '₺', perUsd: 34 },
}

/** « ≈ 1 450 ₹ » pour un prix déjà converti dans sa devise de paiement, ou null si la devise locale est celle du paiement. */
export function localEquivalent(price: { amount: number; currency: DisplayCurrency }, country: string | null | undefined): string | null {
  const local = LOCAL[(country || '').toUpperCase()]
  if (!local) return null
  const usd = price.currency === 'USD' ? price.amount : price.currency === 'EUR' ? (price.amount * FCFA_PER_EUR) / FCFA_PER_USD : price.amount / FCFA_PER_USD
  const v = usd * local.perUsd
  const rounded = v >= 1000 ? Math.round(v / 10) * 10 : v >= 100 ? Math.round(v) : Math.round(v * 100) / 100
  return `≈ ${new Intl.NumberFormat('fr-FR').format(rounded).replace(/[  ]/g, ' ')} ${local.symbol}`
}

/** Libellé de la devise prélevée : « FCFA (XAF) », « FCFA (XOF) », « euros », « dollars US ». */
export const chargedCurrencyLabel = (c: DisplayCurrency) => ({ XAF: 'FCFA (XAF)', XOF: 'FCFA (XOF)', EUR: 'euros', USD: 'dollars US' })[c]
