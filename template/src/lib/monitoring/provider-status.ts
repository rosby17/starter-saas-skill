import { serviceClient } from '@/lib/auth/service-client'

// Fournisseur « ralenti » = plusieurs clients DIFFÉRENTS ont reçu une panne fournisseur ces dernières minutes.
// Un échec isolé ne déclenche rien.
const WINDOW_MS = 10 * 60 * 1000
const MIN_FAILURES = 4
const MIN_DISTINCT_CLIENTS = 2
const CACHE_MS = 30 * 1000
let cache: { at: number; degraded: boolean } | null = null

export async function isProviderDegraded(): Promise<boolean> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.degraded
  let degraded = false
  try {
    const { data } = await serviceClient()
      .from('error_logs')
      .select('user_id, ip')
      .eq('details->>error_code', 'provider_unavailable')
      .gte('created_at', new Date(Date.now() - WINDOW_MS).toISOString())
      .limit(200)
    const rows = data || []
    degraded = rows.length >= MIN_FAILURES && new Set(rows.map((r) => r.user_id || r.ip || 'inconnu')).size >= MIN_DISTINCT_CLIENTS
  } catch (error) {
    console.error('[provider-status] échec', error)
  }
  cache = { at: Date.now(), degraded }
  return degraded
}
