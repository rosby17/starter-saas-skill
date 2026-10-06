import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { collectLocalMetrics, collectRemoteMetrics } from '@/lib/server-resource-metrics'
import { readServerResourceHistory } from '@/lib/server-resource-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Mesures actuelles + historique 24 h. Si le collecteur de l'hôte (SERVER_METRICS_URL, voir ops/vps-metrics-agent.py)
// ne répond pas, on retombe sur les mesures du conteneur et on le dit.
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const remoteUrl = process.env.SERVER_METRICS_URL?.trim()
  let agentError: string | null = null
  let metrics = null
  if (remoteUrl) {
    try { metrics = await collectRemoteMetrics(remoteUrl) } catch (error) { agentError = (error instanceof Error ? error.message : String(error)).slice(0, 300) }
  }
  if (!metrics) {
    try { metrics = await collectLocalMetrics() } catch (error) {
      return NextResponse.json({ success: false, message: `Mesures illisibles : ${(error as Error).message}` }, { status: 503 })
    }
  }
  const history = await readServerResourceHistory()
  return NextResponse.json({ success: true, metrics, history, agentError, agentConfigured: Boolean(remoteUrl) })
}
