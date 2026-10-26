import { serviceClient } from '@/lib/auth/service-client'
import type { ServiceOutages } from '@/lib/monitoring/provider-watchdog-policy'

// Services EN PAUSE (system_settings, clé « service_outages ») : posés par la sonde des moteurs ou par l'admin.
// Lus par les routes de l'espace client AVANT tout débit (engines/guard.ts) et par le bandeau. Jamais appliqués
// aux appels faits avec une clé d'API, ni au reste du site.
const KEY = 'service_outages'
const CACHE_MS = 15_000
let cache: { at: number; value: ServiceOutages } | null = null

export async function readServiceOutages(options: { fresh?: boolean } = {}): Promise<ServiceOutages> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const { data, error } = await serviceClient().from('system_settings').select('value').eq('key', KEY).maybeSingle()
    if (error) throw error
    const value = (data?.value && typeof data.value === 'object' ? data.value : {}) as ServiceOutages
    cache = { at: Date.now(), value }
    return value
  } catch (error) {
    // En cas de doute, le service reste ouvert : fermer à tort bloque des clients.
    console.error('[service-outages] lecture impossible', error)
    return cache?.value ?? {}
  }
}

export async function writeServiceOutages(value: ServiceOutages) {
  const { error } = await serviceClient().from('system_settings').upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
  cache = { at: Date.now(), value }
}

/** Le service est-il en pause pour ce client ? Les appels avec clé d'API ne le sont jamais. */
export async function isServiceClosedForClient(service: string, isApiKey = false): Promise<boolean> {
  if (isApiKey) return false
  return Boolean((await readServiceOutages())[service])
}
