import type { SupabaseClient } from '@supabase/supabase-js'

// Réglages des crédits, dans system_settings (migration 20261026120100), modifiés dans Administration › Crédits.
// Lus par le SERVEUR avec la clé service : un client ne peut ni les lire ni les changer.
//   recharge_nudge  : seuil du « solde faible » et pause après « Plus tard »
//   welcome_credits : crédits offerts à chaque nouveau compte (trigger SQL grant_welcome_credits)
//   free_window     : services gratuits jusqu'à une date (« illimité » le temps d'un lancement ou d'un essai)

export type NudgeConfig = { threshold: number; snoozeDays: number }
export type WelcomeConfig = { amount: number; validityDays: number | null }
export type FreeWindow = { services: string[]; until: string | null; label: string }

/** « * » dans services = tous les services payants sont gratuits pendant la fenêtre. */
export const ALL_SERVICES = '*'

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : fallback

export function parseNudge(v: unknown): NudgeConfig {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return { threshold: int(r.threshold, 0, 100_000_000, 500), snoozeDays: int(r.snoozeDays, 0, 90, 3) }
}

export function parseWelcome(v: unknown): WelcomeConfig {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const days = int(r.validityDays, 1, 3660, 0)
  return { amount: int(r.amount, 0, 1_000_000, 0), validityDays: days || null }
}

export function parseFreeWindow(v: unknown): FreeWindow {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const services = Array.isArray(r.services) ? r.services.filter((s): s is string => typeof s === 'string' && /^[\w*.:-]{1,60}$/.test(s)).slice(0, 30) : []
  const until = typeof r.until === 'string' && !Number.isNaN(Date.parse(r.until)) ? new Date(r.until).toISOString() : null
  return { services, until, label: typeof r.label === 'string' ? r.label.slice(0, 120) : '' }
}

/** La fenêtre de gratuité couvre-t-elle ce service à cet instant ? Elle se referme seule à l'heure de fin. */
export function isFreeAt(w: FreeWindow | null, service: string, now = Date.now()): boolean {
  if (!w?.until || Date.parse(w.until) <= now) return false
  return w.services.includes(ALL_SERVICES) || w.services.includes(service)
}

export async function readSetting(db: SupabaseClient, key: 'recharge_nudge' | 'welcome_credits' | 'free_window'): Promise<unknown> {
  const { data, error } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

let freeCache: { at: number; value: FreeWindow | null } | null = null

/** Fenêtre de gratuité en cours (cache de 15 s : lue à chaque débit). En cas de doute, facturation normale. */
export async function readFreeWindow(db: SupabaseClient): Promise<FreeWindow | null> {
  if (freeCache && Date.now() - freeCache.at < 15_000) return freeCache.value
  try {
    const value = parseFreeWindow(await readSetting(db, 'free_window'))
    freeCache = { at: Date.now(), value }
    return value
  } catch (error) {
    console.error('Fenêtre de gratuité illisible :', error)
    return freeCache?.value ?? null
  }
}

/** À appeler après un changement de réglage, pour que la nouvelle fenêtre s'applique tout de suite sur ce serveur. */
export function forgetFreeWindow() {
  freeCache = null
}
