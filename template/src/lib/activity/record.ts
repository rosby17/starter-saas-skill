import 'server-only'

import { serviceClient } from '@/lib/auth/service-client'
import type { ActivitySource, ActivityStatus } from './types'

// Enregistre une action dans le fil d'activité (table activity_events, Administration › Activité).
// NE LÈVE JAMAIS : noter une action ne doit pas faire échouer l'action elle-même.
//
// Usage :
//   await recordActivity({ userId, action: 'demande.nouvelle', label: 'Nouvelle demande : Audit', detail: texte })
//   // Action longue : une ligne « en cours », ses étapes, puis sa fin.
//   const id = await startActivity({ userId, action: 'export', label: 'Export du catalogue' })
//   await recordActivity({ parentId: id, action: 'export.etape', label: '120 produits lus' })
//   await finishActivity(id, { status: 'succeeded' })
//
// Les inscriptions et les commandes sont notées par la base elle-même (déclencheurs de la migration
// 20261026110000_fil_activite.sql) : inutile de les noter ici.

export type ActivityInput = {
  userId?: string | null
  /** Clé stable, pour les filtres (ex. 'demande.nouvelle', 'credits.debit'). */
  action: string
  /** Phrase affichée dans le fil (ex. « Nouvelle demande : Audit »). */
  label: string
  source?: ActivitySource
  status?: ActivityStatus
  amount?: number | null
  currency?: string | null
  /** Texte long (message, consigne, réponse) : lisible quand on ouvre la ligne. */
  detail?: string | null
  error?: string | null
  metadata?: Record<string, unknown>
  /** Étape d'une action longue (identifiant rendu par startActivity). */
  parentId?: string | null
  /** Objet concerné, pour ouvrir sa fiche (ex. { table: 'service_requests', id }). */
  ref?: { table: string; id: string } | null
}

const cut = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null)

/** Ajoute une ligne au fil. Rend son identifiant, ou null si l'écriture a échoué (journalisé en console). */
export async function recordActivity(input: ActivityInput): Promise<string | null> {
  try {
    const status = input.status ?? 'succeeded'
    const { data, error } = await serviceClient().from('activity_events').insert({
      user_id: input.userId ?? null,
      action: input.action.slice(0, 80),
      label: input.label.slice(0, 300),
      source: input.source ?? 'site',
      status,
      finished_at: status === 'running' ? null : new Date().toISOString(),
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      detail: cut(input.detail, 20000),
      error: cut(input.error, 2000),
      metadata: input.metadata ?? {},
      parent_id: input.parentId ?? null,
      ref_table: input.ref?.table ?? null,
      ref_id: input.ref?.id ?? null,
    }).select('id').single()
    if (error) throw error
    return data.id as string
  } catch (error) {
    console.error('[activité] enregistrement impossible (migration 20261026110000 appliquée ?)', error)
    return null
  }
}

/** Ouvre une action longue (statut « en cours ») : ses étapes s'y rattachent avec parentId. */
export const startActivity = (input: Omit<ActivityInput, 'status' | 'parentId'>) => recordActivity({ ...input, status: 'running' })

/** Termine une action ouverte par startActivity. */
export async function finishActivity(id: string | null, result: { status: Exclude<ActivityStatus, 'running'>; error?: string | null; label?: string; metadata?: Record<string, unknown> }): Promise<void> {
  if (!id) return
  try {
    const { error } = await serviceClient().from('activity_events').update({
      status: result.status,
      finished_at: new Date().toISOString(),
      ...(result.error !== undefined ? { error: cut(result.error, 2000) } : {}),
      ...(result.label ? { label: result.label.slice(0, 300) } : {}),
      ...(result.metadata ? { metadata: result.metadata } : {}),
    }).eq('id', id)
    if (error) throw error
  } catch (error) {
    console.error('[activité] fin de l\'action impossible', error)
  }
}
