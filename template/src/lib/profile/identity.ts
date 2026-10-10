import type { SupabaseClient } from '@supabase/supabase-js'

export type MemberStatus = 'admin' | 'pro' | 'eleve' | 'inscrit'
export const STATUS_LABEL: Record<MemberStatus, string> = { admin: 'Fondateur', pro: 'Membre Pro', eleve: 'Élève', inscrit: 'Inscrit' }

/** Photo du profil : celle choisie dans Mon compte, sinon celle du compte Google, sinon rien (initiales). */
export function avatarOf(profileAvatar: string | null | undefined, meta?: Record<string, unknown> | null): string | null {
  if (profileAvatar) return profileAvatar
  const m = meta ?? {}
  return typeof m.avatar_url === 'string' ? m.avatar_url : typeof m.picture === 'string' ? m.picture : null
}

/**
 * Statut de plusieurs membres d'un coup (client service) : Fondateur (admin) > Membre Pro (abonnement « Rester à jour »
 * en cours) > Élève (une formation ou un accompagnement à vie) > Inscrit.
 */
export async function memberStatuses(db: SupabaseClient, ids: string[]): Promise<Map<string, MemberStatus>> {
  const out = new Map<string, MemberStatus>()
  if (!ids.length) return out
  const [{ data: profiles }, { data: ents }] = await Promise.all([
    db.from('profiles').select('id, is_admin').in('id', ids),
    db.from('entitlements').select('user_id, expires_at, products(category, covers_all)').in('user_id', ids).is('revoked_at', null),
  ])
  for (const id of ids) out.set(id, 'inscrit')
  const now = Date.now()
  for (const e of (ents ?? []) as { user_id: string; expires_at: string | null; products: { category: string; covers_all: boolean } | { category: string; covers_all: boolean }[] | null }[]) {
    const p = Array.isArray(e.products) ? e.products[0] : e.products
    if (p?.covers_all && e.expires_at && new Date(e.expires_at).getTime() > now) out.set(e.user_id, 'pro')
    else if (!e.expires_at && (p?.category === 'formation' || p?.category === 'accompagnement') && out.get(e.user_id) === 'inscrit') out.set(e.user_id, 'eleve')
  }
  for (const p of profiles ?? []) if (p.is_admin) out.set(p.id, 'admin')
  return out
}
