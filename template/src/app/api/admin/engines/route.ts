import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { logAdminAction } from '@/lib/auth/audit'
import { serviceClient } from '@/lib/auth/service-client'
import { ENGINES, getEngine, getModel, getService, SERVICES } from '@/lib/engines/catalog'
import { clearEngine, engineSetAside } from '@/lib/engines/health'
import { activeEngineId, engineState, pickEngineFor } from '@/lib/engines/router'
import { readEngineSettings, updateEngineSettings } from '@/lib/engines/settings'
import { readServiceOutages, writeServiceOutages } from '@/lib/monitoring/service-outages'
import { closeService, reopenService } from '@/lib/monitoring/provider-watchdog-policy'
import { readWatchdogState, watchdogEnvOff } from '@/lib/monitoring/provider-watchdog'

export const dynamic = 'force-dynamic'

// Administration › Moteurs IA. Aucun nom de fournisseur ne sort d'ici : seulement les noms de code (codenames.ts).
async function snapshot() {
  const [settings, outages, watch] = await Promise.all([readEngineSettings({ fresh: true }), readServiceOutages({ fresh: true }), readWatchdogState()])
  const engines = ENGINES.map((engine) => ({
    id: engine.id,
    codename: engine.codename,
    cost: engine.cost ?? null,
    accounts: engine.accounts().length,
    state: engineState(engine),
    setAsideReason: engineSetAside(engine.id)?.reason ?? null,
    hasProbe: Boolean(engine.probe),
  }))
  const services = SERVICES.map((service) => ({
    id: service.id,
    label: service.label,
    watched: Boolean(service.watch),
    outage: outages[service.id] ?? null,
    watch: watch[service.id] ? { down: watch[service.id].down, failures: watch[service.id].failures, lastProbeAt: watch[service.id].lastProbeAt ?? null } : null,
    models: service.models.map((model) => {
      const picked = pickEngineFor(model, settings)
      return { id: model.id, label: model.label, engines: model.engines, active: activeEngineId(model, settings), servedBy: picked?.engine.id ?? null, fallback: picked?.fallback ?? false }
    }),
  }))
  return { engines, services, autoFallback: settings.autoFallback, watchdog: { enabled: settings.watchdog, envOff: watchdogEnvOff() } }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  try {
    return NextResponse.json({ success: true, ...(await snapshot()) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin engines] GET', error)
    return NextResponse.json({ success: false, message: 'Impossible de lire l’état des moteurs.' }, { status: 500 })
  }
}

// Une seule action par appel :
//  { model, engine }        moteur actif d'un modèle
//  { autoFallback: bool }   bascule automatique vers un autre moteur du même modèle
//  { watchdog: bool }       sonde des moteurs
//  { pause | reopen: id }   mettre en pause / rouvrir un service à la main
//  { clear: engineId }      remettre en service un moteur mis de côté
export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const bad = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })
  try {
    let action = ''
    if (typeof body?.model === 'string' && typeof body?.engine === 'string') {
      const found = getModel(body.model)
      if (!found || !found.model.engines.includes(body.engine as never)) return bad('Ce moteur ne sait pas servir ce modèle.')
      const engine = body.engine
      const model = found.model.id
      await updateEngineSettings((current) => ({ ...current, active: { ...current.active, [model]: engine } }))
      action = `engine.active ${model}=${engine}`
    } else if (typeof body?.autoFallback === 'boolean') {
      const value = body.autoFallback
      await updateEngineSettings((current) => ({ ...current, autoFallback: value }))
      action = `engine.autoFallback=${value}`
    } else if (typeof body?.watchdog === 'boolean') {
      const value = body.watchdog
      await updateEngineSettings((current) => ({ ...current, watchdog: value }))
      action = `engine.watchdog=${value}`
    } else if (typeof body?.pause === 'string' || typeof body?.reopen === 'string') {
      const id = String(body.pause ?? body.reopen)
      if (!getService(id)) return bad('Service inconnu.')
      const current = await readServiceOutages({ fresh: true })
      const next = typeof body.pause === 'string' ? closeService(current, id, new Date(), { auto: false, trigger: 'admin' }) : reopenService(current, id)
      if (next) await writeServiceOutages(next)
      action = `service.${typeof body.pause === 'string' ? 'pause' : 'reopen'} ${id}`
    } else if (typeof body?.clear === 'string') {
      if (!getEngine(body.clear)) return bad('Moteur inconnu.')
      clearEngine(body.clear)
      action = `engine.clear ${body.clear}`
    } else {
      return bad('Action inconnue.')
    }
    await logAdminAction(serviceClient(), auth.userId, action, { type: 'engines', id: action.split(' ')[0] })
    return NextResponse.json({ success: true, ...(await snapshot()) })
  } catch (error) {
    console.error('[admin engines] PUT', error)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  }
}
