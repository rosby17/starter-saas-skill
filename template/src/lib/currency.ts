import { createClient } from '@supabase/supabase-js'

// Les passerelles de paiement africaines facturent en FCFA (XOF / XAF) quelle que soit la devise affichée au client.
// Taux : table exchange_rates (mise à jour par le cron update-rates) ; valeurs de secours si elle est vide.
const FALLBACK_RATE_TO_USD: Record<string, number> = { USD: 1, EUR: 0.92, XOF: 610, XAF: 610, FCFA: 610 }

export const isFcfaLike = (currency: string) => ['XOF', 'XAF', 'FCFA'].includes(currency.toUpperCase())

async function rateToUsd(currency: string): Promise<number> {
  const code = currency.toUpperCase() === 'XOF' || currency.toUpperCase() === 'XAF' ? 'FCFA' : currency.toUpperCase()
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data } = await db.from('exchange_rates').select('rate_to_usd').eq('currency_code', code).maybeSingle()
    if (data?.rate_to_usd) return Number(data.rate_to_usd)
  } catch {
    // table absente ou injoignable : valeur de secours
  }
  return FALLBACK_RATE_TO_USD[code] ?? 1
}

/** Montant exprimé en FCFA, arrondi à l'entier (c'est ce que les passerelles attendent). */
export async function toFcfa(amount: number, currency: string): Promise<number> {
  if (isFcfaLike(currency)) return Math.round(amount)
  const usd = amount / (await rateToUsd(currency))
  return Math.round(usd * (await rateToUsd('FCFA')))
}

/** Montant exprimé en USD (référence comptable). */
export async function toUsd(amount: number, currency: string): Promise<number> {
  return Math.round((amount / (await rateToUsd(currency))) * 100) / 100
}
