import 'server-only'

import { serviceClient } from '@/lib/auth/service-client'
import { notifyAdmin } from '@/lib/orders/deliver'
import { recordErrorLog } from '@/lib/monitoring/error-log'
import { readServiceOutages, writeServiceOutages } from '@/lib/monitoring/service-outages'
import { getEngine, SERVICES } from '@/lib/engines/catalog'
import { activeEngineId } from '@/lib/engines/router'
import { readEngineSettings } from '@/lib/engines/settings'
import {
  BLIND_ALERT_AFTER_MS,
  closeService,
  nextWatchdogState,
  probeIntervalMs,
  probeOutcome,
  reopenService,
  type ProbeAttempt,
  type WatchdogState,
} from '@/lib/monitoring/provider-watchdog-policy'

// SONDE DES MOTEURS, passée par la tâche planifiée /api/cron/engine-watchdog (toutes les 1 à 2 minutes). Pour chaque
// service surveillé (catalog.ts, `watch: true`) dont le moteur actif a une sonde : une demande minuscule sur deux
// comptes ; deux sondes ratées d'affilée = le service est mis en pause dans l'espace client (bandeau clair, rien
// n'est débité) ; une sonde qui aboutit = il rouvre. Le site, l'API et les autres services ne sont jamais fermés.
//
// Interrupteurs : Administration › Moteurs IA (« Sonde des moteurs », coupée par défaut : chaque essai est un petit
// appel payant) et, sans redéployer le code, la variable ENGINE_WATCHDOG=off. L'état est gardé en base
// (system_settings, clé « engine_watchdog_state ») : un redémarrage ne fait rien oublier.

const STATE_KEY = 'engine_watchdog_state'
const BLIND_ALERT_EVERY_MS = 6 * 60 * 60 * 1000

type InFlightTask = { accountId: string; taskId: string | null; done?: boolean; hasResult?: boolean; rejected?: boolean; submitFailed?: boolean; message?: string }
type ServiceWatch = WatchdogState & {
  lastProbeAt?: number
  rotation?: number
  rejectedSince?: number | null
  lastBlindAlertAt?: number
  inFlight?: { engine: string; startedAt: number; tasks: InFlightTask[] } | null
}
type WatchState = Record<string, ServiceWatch>

export const watchdogEnvOff = () => process.env.ENGINE_WATCHDOG === 'off'

async function readState(): Promise<WatchState> {
  const { data, error } = await serviceClient().from('system_settings').select('value').eq('key', STATE_KEY).maybeSingle()
  if (error) throw error
  return (data?.value && typeof data.value === 'object' ? data.value : {}) as WatchState
}

async function writeState(state: WatchState) {
  const { error } = await serviceClient().from('system_settings').upsert({ key: STATE_KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

/** État de la sonde pour l'admin (pannes en cours, échecs d'affilée, dernière sonde). */
export async function readWatchdogState(): Promise<WatchState> {
  try { return await readState() } catch { return {} }
}

async function closeServiceByProbe(serviceId: string, label: string, engineCodename: string, attempts: ProbeAttempt[]) {
  const next = closeService(await readServiceOutages({ fresh: true }), serviceId, new Date(), { trigger: 'probe' })
  if (!next) return
  await writeServiceOutages(next)
  const cause = `Deux sondes d'affilée (une demande minuscule sur ${attempts.length > 1 ? 'deux comptes' : 'un compte'} ${engineCodename}) sont restées sans résultat : le moteur accepte les demandes mais n'en termine aucune.`
  await recordErrorLog({
    source: 'server',
    action: 'engine-watchdog',
    errorMessage: `« ${label} » mis en pause : le moteur ${engineCodename} ne termine plus les demandes.`,
    details: {
      reason: 'service_closed_by_probe',
      service: serviceId,
      cause,
      fix: `Automatique : seul « ${label} » est en pause dans l'espace client, avec un bandeau ; le site, l'API et les autres services restent ouverts. Il rouvre seul dès qu'une sonde aboutit. Prévenir le fournisseur du moteur ${engineCodename}, ou choisir un autre moteur pour ce modèle dans Administration › Moteurs IA.`,
      probes: attempts.map((a) => ({ status: a.status || null, submit_failed: !!a.submitFailed, age_s: Math.round(a.ageMs / 1000) })),
    },
  })
  await notifyAdmin(`« ${label} » mis en pause automatiquement`, [cause, 'Le reste du site fonctionne. Le service rouvrira seul dès que le moteur répondra de nouveau.'], '/admin/moteurs')
}

async function reopenServiceByProbe(serviceId: string) {
  // Une pause posée par l'admin n'est jamais levée par la sonde.
  const next = reopenService(await readServiceOutages({ fresh: true }), serviceId, { onlyAuto: true })
  if (next) await writeServiceOutages(next)
}

async function watchBlindProbe(watch: ServiceWatch, serviceId: string, engineCodename: string, allRejected: boolean, message: string) {
  const now = Date.now()
  if (!allRejected) { watch.rejectedSince = null; return }
  watch.rejectedSince ??= now
  if (now - watch.rejectedSince < BLIND_ALERT_AFTER_MS || now - (watch.lastBlindAlertAt ?? 0) < BLIND_ALERT_EVERY_MS) return
  watch.lastBlindAlertAt = now
  await recordErrorLog({
    source: 'server',
    action: 'engine-watchdog',
    errorMessage: `La sonde du moteur ${engineCodename} est refusée depuis plus d'une heure : elle ne détecte plus les pannes.`,
    details: { reason: 'probe_rejected', service: serviceId, message: message.slice(0, 300), cause: 'Le fournisseur refuse la demande de sonde (paramètre, voix, modèle ou solde) : la mise en pause automatique est aveugle.', fix: 'Vérifier la sonde du moteur dans src/lib/engines/catalog.ts et le solde du compte.' },
  })
}

/** Un passage de la sonde. Renvoie ce qui a été fait (pour la réponse de la tâche planifiée). */
export async function runWatchdogPass(): Promise<{ skipped?: string; probed: string[]; closed: string[]; reopened: string[] }> {
  const result = { probed: [] as string[], closed: [] as string[], reopened: [] as string[] }
  if (watchdogEnvOff()) return { ...result, skipped: 'ENGINE_WATCHDOG=off' }
  const settings = await readEngineSettings({ fresh: true })
  if (!settings.watchdog) return { ...result, skipped: 'sonde coupée dans Administration › Moteurs IA' }
  const state = await readState()

  for (const service of SERVICES.filter((s) => s.watch)) {
    const model = service.models[0]
    const engine = model ? getEngine(activeEngineId(model, settings)) : null
    if (!engine?.probe) continue
    const watch: ServiceWatch = state[service.id] ?? { down: false, failures: 0 }
    state[service.id] = watch
    const accounts = engine.accounts()
    if (!accounts.length) continue

    // Tranche une sonde dont toutes les réponses sont connues (pause, réouverture, alerte de sonde aveugle).
    const settle = async (tasks: InFlightTask[], attempts: ProbeAttempt[]) => {
      const outcome = probeOutcome(attempts)
      if (outcome === 'pending') return false
      watch.inFlight = null
      result.probed.push(service.id)
      await watchBlindProbe(watch, service.id, engine.codename, attempts.every((a) => a.rejected), tasks.find((t) => t.message)?.message ?? '')
      const { state: next, action } = nextWatchdogState(watch, outcome)
      watch.down = next.down
      watch.failures = next.failures
      if (action === 'enter') { await closeServiceByProbe(service.id, service.label, engine.codename, attempts); result.closed.push(service.id) }
      // Après un redémarrage ou une pause posée avant, tout succès lève une pause posée par la sonde.
      if (outcome === 'ok') { await reopenServiceByProbe(service.id); if (action === 'exit') result.reopened.push(service.id) }
      return true
    }

    // Sonde en cours : on lit où en sont les tâches déposées au passage précédent.
    if (watch.inFlight && watch.inFlight.engine === engine.id) {
      const { tasks, startedAt } = watch.inFlight
      const ageMs = Date.now() - startedAt
      const attempts: ProbeAttempt[] = await Promise.all(tasks.map(async (task) => {
        if (task.rejected || task.submitFailed) return { rejected: task.rejected, submitFailed: task.submitFailed, ageMs }
        if (task.done) return { status: 'done', hasResult: task.hasResult, ageMs }
        const account = accounts.find((a) => a.id === task.accountId)
        if (!account || !task.taskId || !engine.probe?.read) return { status: 'pending', ageMs }
        // Lecture impossible : traitée comme « encore en cours », le délai tranchera.
        const read = await engine.probe.read(account, task.taskId).catch(() => null)
        return read ? { status: read.status, hasResult: read.hasResult, ageMs } : { status: 'pending', ageMs }
      }))
      await settle(tasks, attempts)
      continue
    }

    if (Date.now() - (watch.lastProbeAt ?? 0) < probeIntervalMs(watch)) continue
    // Deux comptes différents, en tournant pour ne pas toujours solliciter les mêmes.
    const rotation = watch.rotation ?? 0
    const picked = [...new Set([accounts[rotation % accounts.length], accounts[(rotation + 1) % accounts.length]])]
    watch.rotation = rotation + 1
    const startedAt = Date.now()
    watch.lastProbeAt = startedAt
    const tasks: InFlightTask[] = await Promise.all(picked.map(async (account) => {
      try {
        const sent = await engine.probe!.submit(account)
        return { accountId: account.id, taskId: sent.taskId ?? null, done: sent.done, hasResult: sent.hasResult, rejected: sent.rejected, submitFailed: sent.failed, message: sent.message }
      } catch (error) {
        return { accountId: account.id, taskId: null, submitFailed: true, message: error instanceof Error ? error.message : String(error) }
      }
    }))
    watch.inFlight = { engine: engine.id, startedAt, tasks }
    // Moteur à réponse directe : tout est déjà connu, on tranche tout de suite.
    if (tasks.every((t) => t.done || t.rejected || t.submitFailed)) {
      const ageMs = Date.now() - startedAt
      await settle(tasks, tasks.map((t) => (t.rejected || t.submitFailed ? { rejected: t.rejected, submitFailed: t.submitFailed, ageMs } : { status: 'done', hasResult: t.hasResult, ageMs })))
    }
  }

  await writeState(state)
  return result
}
