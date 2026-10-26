import { serviceClient } from '@/lib/auth/service-client'
import { explainError } from '@/lib/monitoring/explain-error'
import { fixFor, latestFixAt } from '@/lib/monitoring/fix-registry'
import { normalizeErrorScope, successResolutionFilter } from '@/lib/monitoring/error-scope'

// Les erreurs se ferment SEULES : l'administrateur ne coche « Résolu » qu'en dernier recours.
//  1. correctif livré (registre fix-registry.ts) : les erreurs qu'il règle, antérieures à sa mise en ligne, sont
//     fermées dès le passage suivant, sans attendre 24 h ;
//  2. la même action réussit de nouveau (resolveErrorsOnSuccess, plus bas) : fermée tout de suite ;
//  3. erreurs sans suite (client, fournisseur, proxy) : classées après 24 h ;
//  4. vrais problèmes : résolus après 24 h SANS récidive (si ça revient, une nouvelle ligne s'ouvre) ;
//  5. erreurs fermées depuis plus de 30 jours : supprimées (le journal ne grossit pas).
// Une erreur fermée à la main n'est jamais rouverte ici.
const HOURS = 24
const RETENTION_DAYS = 30
const THROTTLE_MS = 10 * 60 * 1000
let lastRun = 0

type Db = ReturnType<typeof serviceClient>

async function closeIds(supabase: Db, ids: string[], note: string, now: string) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('error_logs').update({ resolved_at: now, resolution_note: note }).in('id', ids.slice(i, i + 200)).is('resolved_at', null)
    if (error) throw error
  }
}

// Erreurs réglées par un correctif livré : fermées avec la PR et le résumé du correctif dans la note.
async function closeFixedErrors(supabase: Db, now: string) {
  const lastFix = latestFixAt()
  if (!lastFix) return
  const { data, error } = await supabase
    .from('error_logs')
    .select('id, created_at, action, http_status, error_message, details, page')
    .is('resolved_at', null)
    .lt('created_at', lastFix)
    .limit(2000)
  if (error) throw error
  const byFix = new Map<string, { note: string; ids: string[] }>()
  for (const row of data || []) {
    const fix = fixFor(row)
    if (!fix) continue
    const entry = byFix.get(fix.id) ?? { note: `Corrigée${fix.pr ? ` par la PR #${fix.pr}` : ''} : ${fix.summary}.`, ids: [] }
    entry.ids.push(row.id)
    byFix.set(fix.id, entry)
  }
  for (const { note, ids } of byFix.values()) await closeIds(supabase, ids, note, now)
}

export async function autoResolveStaleErrors() {
  if (Date.now() - lastRun < THROTTLE_MS) return
  lastRun = Date.now()
  try {
    const supabase = serviceClient()
    const now = new Date().toISOString()
    await closeFixedErrors(supabase, now)

    const { data, error } = await supabase
      .from('error_logs')
      .select('id, source, action, http_status, error_message, details')
      .is('resolved_at', null)
      .lt('created_at', new Date(Date.now() - HOURS * 3600 * 1000).toISOString())
      .limit(2000)
    if (error) throw error
    const low: string[] = []
    const system: string[] = []
    for (const row of data || []) (explainError(row).severity === 'low' ? low : system).push(row.id)
    if (low.length) await closeIds(supabase, low, `Classée automatiquement : sans suite après ${HOURS} h.`, now)
    if (system.length) await closeIds(supabase, system, `Résolue automatiquement : aucune récidive depuis ${HOURS} h.`, now)

    const { error: purgeError } = await supabase.from('error_logs').delete().not('resolved_at', 'is', null).lt('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString())
    if (purgeError) throw purgeError
  } catch (error) {
    console.error('[auto-resolve] échec', error)
  }
}

// ── Fermeture sur succès ─────────────────────────────────────────────────────
// Une erreur se ferme dès que la même action (« POST /api/… ») réussit de nouveau : une fois la cause réglée
// (migration appliquée, fournisseur revenu, correctif déployé), personne n'a à la cocher. Pour ne pas écrire en
// base à chaque succès, on garde en mémoire les actions qui ont des erreurs ouvertes (relues toutes les minutes).
// Appelée côté SERVEUR uniquement (with-success-close.ts, ou après une opération réussie) : un navigateur ne peut
// pas fermer une erreur.
const OPEN_ACTIONS_TTL_MS = 60 * 1000
let openActions: { at: number; actions: Set<string> } | null = null
let openActionsLoading: Promise<Set<string>> | null = null

async function currentOpenActions(): Promise<Set<string>> {
  if (openActions && Date.now() - openActions.at < OPEN_ACTIONS_TTL_MS) return openActions.actions
  openActionsLoading ??= (async () => {
    const { data, error } = await serviceClient().from('error_logs').select('action').is('resolved_at', null).limit(5000)
    if (error) throw error
    const actions = new Set((data || []).map((row) => row.action as string))
    openActions = { at: Date.now(), actions }
    return actions
  })().finally(() => { openActionsLoading = null })
  return openActionsLoading
}

/** Appelée par recordErrorLog : une erreur toute neuve est fermable sans attendre la relecture. */
export function markActionOpen(action: string) {
  openActions?.actions.add(action)
}

/** Ferme les erreurs ouvertes de cette action survenues avant `succeededAt` (portée facultative). Ne lève jamais. */
export async function resolveErrorsOnSuccess(action: string, succeededAt = new Date(), rawScope?: string | null) {
  try {
    const actions = await currentOpenActions()
    if (!actions.has(action)) return
    const scope = normalizeErrorScope(rawScope)
    // Un succès étiqueté peut laisser ouvertes des erreurs d'une autre portée : l'action reste alors marquée ouverte.
    if (!scope) actions.delete(action)
    const { error } = await serviceClient()
      .from('error_logs')
      .update({ resolved_at: new Date().toISOString(), resolution_note: `Résolue automatiquement : « ${action} »${scope ? ` (${scope})` : ''} a de nouveau réussi.` })
      .eq('action', action)
      .is('resolved_at', null)
      .lt('created_at', succeededAt.toISOString())
      .or(successResolutionFilter(scope))
    if (error) throw error
  } catch (error) {
    console.error('[auto-resolve] fermeture sur succès impossible', error)
  }
}
