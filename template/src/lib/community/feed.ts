import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memberStatuses, type MemberStatus } from '@/lib/profile/identity'

export { COMMUNITY_SLUG } from '@/lib/catalog/slugs'
export type Media = { path: string; type: 'image' | 'video' | 'file' | 'audio'; name: string; url?: string; duration?: number }
export type PollMeta = { question: string; options: string[]; multiple?: boolean }
export type EventMeta = { title: string; starts_at: string; place?: string; link?: string }
export type Channel = { id: string; slug: string; name: string; description: string; mode: 'annonces' | 'discussion'; last?: { text: string; at: string; author: string } | null }
export type FeedPost = {
  id: string; kind: 'post' | 'annonce' | 'astuce' | 'poll' | 'event'; body: string; media: Media[]; meta: Partial<PollMeta & EventMeta>
  pinned: boolean; created_at: string; author: string; authorId: string; authorIsAdmin: boolean; isMe: boolean
  avatar: string | null; username: string | null; status: MemberStatus
  reactions: { emoji: string; count: number }[]; mine: string | null
  poll?: { counts: number[]; voters: number; my: number[] }
}

/**
 * Canal de la communauté, du plus ancien au plus récent (comme une conversation), lu avec le client service :
 * l'appelant a DÉJÀ vérifié l'accès du membre. Médias : liens signés d'une heure.
 */
export async function loadFeed(db: SupabaseClient, userId: string, channelId: string, limit = 60, before?: string): Promise<FeedPost[]> {
  // Tout l'historique est gardé : on charge par pages (« Voir les messages précédents »), du plus récent au plus ancien.
  let q = db.from('community_posts').select('id, kind, body, media, meta, pinned, created_at, author_id')
    .eq('channel_id', channelId).order('created_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data: rows } = await q
  const posts = (rows ?? []).reverse()
  if (!posts.length) return []
  const ids = posts.map((p) => p.id)
  const [{ data: reactions }, { data: votes }, { data: profiles }] = await Promise.all([
    db.from('community_reactions').select('post_id, user_id, emoji').in('post_id', ids),
    db.from('community_poll_votes').select('post_id, user_id, option').in('post_id', ids),
    db.from('profiles').select('id, full_name, first_name, is_admin, avatar_url, username').in('id', [...new Set(posts.map((p) => p.author_id))]),
  ])
  const who = new Map((profiles ?? []).map((p) => [p.id as string, { name: (p.full_name || p.first_name || 'Membre') as string, admin: !!p.is_admin, avatar: (p.avatar_url as string | null) ?? null, username: (p.username as string | null) ?? null }]))
  const statuses = await memberStatuses(db, [...who.keys()])
  const paths = posts.flatMap((p) => ((p.media as Media[]) ?? []).map((m) => m.path))
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data } = await db.storage.from('community').createSignedUrls(paths, 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  return posts.map((p) => {
    const rs = (reactions ?? []).filter((r) => r.post_id === p.id)
    const byEmoji = new Map<string, number>()
    for (const r of rs) byEmoji.set(r.emoji, (byEmoji.get(r.emoji) ?? 0) + 1)
    const meta = (p.meta ?? {}) as FeedPost['meta']
    let poll: FeedPost['poll']
    if (p.kind === 'poll') {
      const vs = (votes ?? []).filter((v) => v.post_id === p.id)
      poll = {
        counts: (meta.options ?? []).map((_, i) => vs.filter((v) => v.option === i).length),
        voters: new Set(vs.map((v) => v.user_id)).size,
        my: vs.filter((v) => v.user_id === userId).map((v) => v.option),
      }
    }
    return {
      id: p.id, kind: p.kind, body: p.body, meta, pinned: p.pinned, created_at: p.created_at, author: who.get(p.author_id)?.name ?? 'Membre', authorId: p.author_id, authorIsAdmin: !!who.get(p.author_id)?.admin, isMe: p.author_id === userId,
      avatar: who.get(p.author_id)?.avatar ?? null, username: who.get(p.author_id)?.username ?? null, status: statuses.get(p.author_id) ?? 'inscrit',
      media: ((p.media as Media[]) ?? []).map((m) => ({ ...m, url: urls.get(m.path) })),
      reactions: [...byEmoji].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count),
      mine: rs.find((r) => r.user_id === userId)?.emoji ?? null,
      poll,
    }
  })
}

/** Groupes de la communauté, avec le dernier message de chacun (aperçu de la liste, comme WhatsApp). */
export async function loadChannels(db: SupabaseClient): Promise<Channel[]> {
  const { data: chans } = await db.from('community_channels').select('id, slug, name, description, mode').order('position').order('created_at')
  const list = (chans ?? []) as Channel[]
  const lasts = await Promise.all(list.map((c) => db.from('community_posts').select('body, kind, meta, media, created_at, author_id').eq('channel_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()))
  const ids = [...new Set(lasts.map((l) => l.data?.author_id).filter(Boolean) as string[])]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, first_name').in('id', ids) : { data: [] }
  const name = new Map((profiles ?? []).map((p) => [p.id as string, (p.first_name || p.full_name || 'Membre') as string]))
  return list.map((c, i) => {
    const l = lasts[i].data
    if (!l) return { ...c, last: null }
    const media = (l.media as Media[]) ?? []
    const text = l.body || (l.kind === 'poll' ? `📊 ${(l.meta as PollMeta).question}` : l.kind === 'event' ? `📅 ${(l.meta as EventMeta).title}` : media[0]?.type === 'audio' ? '🎤 Message vocal' : media[0]?.type === 'image' ? '📷 Photo' : media[0]?.type === 'video' ? '🎥 Vidéo' : media.length ? '📄 Fichier' : '')
    return { ...c, last: { text, at: l.created_at, author: name.get(l.author_id) ?? '' } }
  })
}
