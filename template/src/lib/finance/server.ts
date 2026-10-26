import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_CURRENCY_KEY, FALLBACK_FCFA_PER, isCurrency, type Currency, type FcfaPer } from './money'
import { providerRateAt, unitsCostFcfa, type ChargeLine, type ProviderRateRow } from './charges'
import { localDay } from '@/lib/time'

// Lectures serveur du pilotage financier (clé service, derrière requireAdmin).

const PAGE = 1000

/** Lit toutes les pages d'une requête (1 000 lignes par page), jusqu'à `max` lignes. Lève l'erreur de la base. */
export async function readAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }> },
  max = 200_000,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message || 'lecture impossible')
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

/** Combien de FCFA vaut 1 EUR / 1 USD, d'après exchange_rates (cron update-rates) ; valeurs de secours sinon. */
export async function loadFcfaPer(db: SupabaseClient): Promise<FcfaPer> {
  const { data, error } = await db.from('exchange_rates').select('currency_code, rate_to_usd').in('currency_code', ['FCFA', 'XAF', 'XOF', 'EUR', 'USD'])
  if (error || !data?.length) return FALLBACK_FCFA_PER
  const perUsd = new Map(data.map((r) => [String(r.currency_code).toUpperCase(), Number(r.rate_to_usd)]))
  const fcfa = perUsd.get('FCFA') || perUsd.get('XAF') || perUsd.get('XOF') || FALLBACK_FCFA_PER.USD
  const eur = perUsd.get('EUR')
  return { XAF: 1, USD: fcfa / (perUsd.get('USD') || 1), EUR: eur ? fcfa / eur : FALLBACK_FCFA_PER.EUR }
}

/** Devise d'affichage de l'administration (system_settings), FCFA par défaut. */
export async function getAdminCurrency(db: SupabaseClient): Promise<Currency> {
  const { data } = await db.from('system_settings').select('value').eq('key', ADMIN_CURRENCY_KEY).maybeSingle()
  const value = (data?.value as { currency?: unknown } | null)?.currency
  return isCurrency(value) ? value : 'XAF'
}

/**
 * Note l'usage réel d'un fournisseur payé à l'usage, juste APRÈS un appel réussi (caractères, jetons, images, secondes…).
 * La page Revenus en calcule le coût avec le tarif daté du fournisseur : on ne saisit jamais une facture à la main.
 * Ne bloque jamais le service : une erreur d'écriture est seulement journalisée.
 *   await recordProviderUsage(db, { provider: 'fournisseur-a', service: 'synthese', units: text.length, userId, ref: taskId })
 */
export async function recordProviderUsage(
  db: SupabaseClient,
  usage: { provider: string; service?: string; units: number; userId?: string | null; ref?: string | null },
): Promise<void> {
  if (!(usage.units > 0)) return
  const { error } = await db.from('provider_usage').insert({
    provider: usage.provider, service: usage.service ?? '', units: usage.units, user_id: usage.userId ?? null, ref: usage.ref ?? null,
  })
  if (error) console.error('Usage fournisseur non noté :', usage.provider, error.message)
}

/**
 * Coût des fournisseurs sur [fromIso, toIso[ : usage réel × tarif en vigueur LE JOUR de chaque appel (un changement de
 * tarif ne réécrit jamais l'historique). Une ligne par fournisseur (et service s'il a son propre tarif).
 */
export async function providerCosts(db: SupabaseClient, rates: ProviderRateRow[], fromIso: string, toIso: string, fcfaPer: FcfaPer) {
  const { rows, truncated } = await readAll<{ provider: string; service: string; units: number; created_at: string }>(() =>
    db.from('provider_usage').select('provider, service, units, created_at').gte('created_at', fromIso).lt('created_at', toIso).order('created_at') as never, 500_000)
  // Regroupement par fournisseur / service / jour avant de chercher le tarif (beaucoup moins de recherches).
  const byDay = new Map<string, { provider: string; service: string; day: string; units: number }>()
  for (const r of rows) {
    const day = localDay(r.created_at)
    const key = `${r.provider}|${r.service}|${day}`
    const entry = byDay.get(key) ?? { provider: r.provider, service: r.service, day, units: 0 }
    entry.units += Number(r.units) || 0
    byDay.set(key, entry)
  }
  const lines = new Map<string, ChargeLine>()
  for (const e of byDay.values()) {
    const rate = providerRateAt(rates, e.provider, e.service, e.day)
    // Le service a-t-il un tarif à lui ? Sinon il est regroupé sous son fournisseur.
    const own = rate && rate.service === e.service && e.service !== ''
    const id = `v:${e.provider}${own ? `:${e.service}` : ''}`
    const line = lines.get(id) ?? {
      id, family: 'variable' as const, fcfa: 0, units: 0, unpriced: 0, unit: rate?.unit ?? 'unités',
      label: rate?.label || (own ? `${e.provider} · ${e.service}` : e.provider),
    }
    line.units = (line.units ?? 0) + e.units
    if (rate) line.fcfa += unitsCostFcfa(e.units, rate, fcfaPer)
    else line.unpriced = (line.unpriced ?? 0) + e.units
    lines.set(id, line)
  }
  return { lines: [...lines.values()].sort((a, b) => b.fcfa - a.fcfa), truncated }
}
