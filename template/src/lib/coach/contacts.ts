import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { hasModule } from '@/config/site'
import { publicOrigin } from '@/lib/site-url'
import { actionCustomerIds, type StoredDaily } from './daily'
import type { ClientReply, RepliesStore } from './replies'

// Clients du coach : retrouvés chez nous (nom, e-mail, WhatsApp) au moment de l'affichage, jamais envoyés
// au modèle. Partagé par le point du jour et l'e-mail groupé.

/** Lien glissé dans les messages ({lien}) : la recharge de crédits, sinon la boutique. */
export const offerLink = () => `${publicOrigin()}${hasModule('credits') ? '/credits' : '/boutique'}`

export type CoachContact = {
  userId: string
  name: string | null
  firstName: string | null
  email: string | null
  phone: string | null
  country: string | null
  contactedAt: string | null
  emailedAt: string | null
  lastReply: ClientReply | null
}

/**
 * Clients à contacter, action par action (clé = index de l'action). À part : « ignored » (écartés à la main)
 * et « replied » (ont répondu ces 30 derniers jours, la plus récente d'abord).
 */
export async function resolveContacts(db: SupabaseClient, daily: StoredDaily, ignored: Record<string, string>, replies: RepliesStore = {}): Promise<Record<string, CoachContact[]>> {
  const idsByKey = new Map<string, string[]>()
  daily.brief.actions.forEach((action, index) => {
    if (action.kind === 'contacter') idsByKey.set(String(index), actionCustomerIds(daily, action).filter((id) => !ignored[id]))
  })
  if (Object.keys(ignored).length) idsByKey.set('ignored', Object.keys(ignored))
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const replied = Object.entries(replies).filter(([, list]) => (list[0]?.at ?? '') >= since).sort(([, a], [, b]) => b[0].at.localeCompare(a[0].at)).map(([id]) => id).slice(0, 30)
  if (replied.length) idsByKey.set('replied', replied)
  const ids = [...new Set([...idsByKey.values()].flat())]
  if (!ids.length) return {}

  type ProfileRow = { id: string; first_name: string | null; full_name: string | null; username: string | null; email: string | null; phone: string | null; country: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('profiles').select('id, first_name, full_name, username, email, phone, country').in('id', ids.slice(i, i + 200))
    if (error) throw new Error(`profils illisibles : ${error.message}`)
    for (const row of (data ?? []) as ProfileRow[]) profiles.set(row.id, row)
  }
  const contact = (id: string): CoachContact => {
    const p = profiles.get(id)
    const name = p?.full_name?.trim() || p?.first_name?.trim() || p?.username || null
    return {
      userId: id,
      name,
      firstName: p?.first_name?.trim() || p?.full_name?.trim().split(/\s+/)[0] || p?.username || null,
      email: p?.email ?? null,
      phone: p?.phone?.trim() || null,
      country: p?.country ?? null,
      contactedAt: daily.contacted?.[id] ?? null,
      emailedAt: daily.emailed?.[id] ?? null,
      lastReply: replies[id]?.[0] ?? null,
    }
  }
  return Object.fromEntries([...idsByKey.entries()].map(([key, list]) => [key, list.map(contact)]))
}
