import { serviceClient } from '@/lib/auth/service-client'
import { collectLocalMetrics, collectRemoteMetrics } from '@/lib/server-resource-metrics'

export async function readServerResourceHistory() {
  const { data, error } = await serviceClient().from('server_resource_samples')
    .select('collected_at,cpu_percent,memory_percent,disk_percent')
    .gte('collected_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order('collected_at', { ascending: true })
    .limit(1500)
  if (error) return { samples: [], unavailable: true }
  return { samples: data ?? [], unavailable: false }
}

let collecting = false
let lastPrune = 0
async function recordSample() {
  if (collecting) return
  collecting = true
  try {
    const remoteUrl = process.env.SERVER_METRICS_URL?.trim()
    let metrics
    try { metrics = remoteUrl ? await collectRemoteMetrics(remoteUrl) : await collectLocalMetrics() } catch { metrics = await collectLocalMetrics() }
    const db = serviceClient()
    const { error } = await db.from('server_resource_samples').insert({
      collected_at: metrics.collectedAt, source: metrics.source, scope: metrics.scope, hostname: metrics.hostname,
      cpu_percent: metrics.cpu.usagePercent, cpu_steal_percent: metrics.cpu.stealPercent, cpu_load_1: metrics.cpu.load1,
      memory_percent: metrics.memory.usedPercent, memory_used_bytes: metrics.memory.usedBytes, memory_total_bytes: metrics.memory.totalBytes,
      disk_percent: metrics.disk.usedPercent,
    })
    if (error) console.error('[server-resources] enregistrement impossible', error)
    if (Date.now() - lastPrune > 3600 * 1000) {
      lastPrune = Date.now()
      await db.from('server_resource_samples').delete().lt('collected_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
    }
  } catch (error) {
    console.error('[server-resources] mesure impossible', error)
  } finally {
    collecting = false
  }
}

// Une mesure par minute, en production seulement (appelé au démarrage : instrumentation-node.ts).
export function startServerResourceSampler() {
  if (process.env.NODE_ENV !== 'production') return
  void recordSample()
  setInterval(() => void recordSample(), 60_000).unref()
}
