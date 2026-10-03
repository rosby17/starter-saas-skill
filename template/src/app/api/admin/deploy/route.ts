import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { logAdminAction } from '@/lib/auth/audit'
import { serviceClient } from '@/lib/auth/service-client'
import { isPlaceholder } from '@/lib/secrets/catalog'
import { coolify } from '@/lib/deploy/coolify'
import { hostinger } from '@/lib/deploy/dns'
import { DeployError, normalizeDomain } from '@/lib/deploy/http'
import { getDeploySettings, getDeployState, saveDeploySettings, startDeploy } from '@/lib/deploy/runner'

export const dynamic = 'force-dynamic'

const has = (name: string) => !isPlaceholder(process.env[name])
const fail = (error: unknown) => {
  const status = error instanceof DeployError ? error.status : 500
  if (!(error instanceof DeployError)) console.error('Mise en ligne :', error)
  return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Erreur inattendue.' }, { status })
}

// GET : réglages, état d'avancement, clés présentes (jamais leur valeur), serveurs Coolify.
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const [settings, state] = await Promise.all([getDeploySettings(), getDeployState()])
  const keys = Object.fromEntries(['COOLIFY_URL', 'COOLIFY_API_TOKEN', 'GITHUB_TOKEN', 'HOSTINGER_API_TOKEN', 'CLOUDFLARE_API_TOKEN'].map((k) => [k, has(k)]))
  let servers: Array<{ uuid: string; name: string; ip: string }> = []
  let serversError: string | null = null
  if (keys.COOLIFY_URL && keys.COOLIFY_API_TOKEN) {
    try { servers = (await coolify(process.env.COOLIFY_URL!, process.env.COOLIFY_API_TOKEN!).listServers()).map(({ uuid, name, ip }) => ({ uuid, name, ip })) }
    catch (error) { serversError = (error as Error).message }
  }
  return NextResponse.json({ success: true, settings, state, keys, servers, serversError, local: process.env.NODE_ENV !== 'production' })
}

// POST { action: 'save' | 'check-domain' | 'buy-domain' | 'deploy' | 'redeploy', ... }
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const body = await request.json().catch(() => ({}))
  const db = serviceClient()
  try {
    switch (body.action) {
      case 'save': {
        const patch: Record<string, string> = {}
        if (typeof body.domain === 'string') patch.domain = normalizeDomain(body.domain)
        if (['hostinger', 'cloudflare', 'manual'].includes(body.dnsProvider)) patch.dnsProvider = body.dnsProvider
        if (typeof body.serverUuid === 'string') patch.serverUuid = body.serverUuid
        if (typeof body.serverIp === 'string') {
          if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(body.serverIp.trim())) throw new DeployError('Adresse IP du serveur invalide (ex. 203.0.113.10).')
          patch.serverIp = body.serverIp.trim()
        }
        const settings = await saveDeploySettings(patch)
        return NextResponse.json({ success: true, settings })
      }
      case 'check-domain': {
        const domain = normalizeDomain(String(body.domain || ''))
        const token = process.env.HOSTINGER_API_TOKEN
        if (isPlaceholder(token)) throw new DeployError('Renseigne d’abord le jeton Hostinger.')
        return NextResponse.json({ success: true, domain, ...(await hostinger(token!).checkAvailability(domain)) })
      }
      case 'buy-domain': {
        // Achat réel : le navigateur l'envoie seulement après la confirmation du prix par l'administrateur.
        const domain = normalizeDomain(String(body.domain || ''))
        if (body.confirmed !== true || typeof body.priceId !== 'string') throw new DeployError('Achat non confirmé.')
        const token = process.env.HOSTINGER_API_TOKEN
        if (isPlaceholder(token)) throw new DeployError('Renseigne d’abord le jeton Hostinger.')
        await hostinger(token!).buyDomain(domain, body.priceId)
        await logAdminAction(db, guard.userId, 'domain.buy', { type: 'domain', id: domain }, { priceId: body.priceId })
        const settings = await saveDeploySettings({ domain, dnsProvider: 'hostinger' })
        return NextResponse.json({ success: true, settings })
      }
      case 'deploy':
      case 'redeploy': {
        await startDeploy(body.action === 'deploy' ? 'full' : 'redeploy')
        await logAdminAction(db, guard.userId, `deploy.${body.action}`, { type: 'site', id: (await getDeploySettings()).domain || '' })
        return NextResponse.json({ success: true })
      }
      default:
        throw new DeployError('Action inconnue.')
    }
  } catch (error) {
    return fail(error)
  }
}
