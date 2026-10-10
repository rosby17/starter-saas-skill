import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { serviceClient } from '@/lib/auth/service-client'
import { loadFeed } from '@/lib/community/feed'
import { site } from '@/config/site'
import { COMMUNITY_SLUG } from '@/lib/catalog/slugs'

// Publier dans un groupe de la communauté. Groupe « annonces » : l'administrateur seul (texte, médias, vocal, sondage,
// événement) ; groupe « discussion » : tout membre, messages simples (texte, photos, fichiers, vocaux).
// Un message dans les Annonces prévient les membres (cloche ; une seule notification non lue à la fois).
const media = z.object({ path: z.string().max(300), type: z.enum(['image', 'video', 'file', 'audio']), name: z.string().max(160), duration: z.number().min(0).max(3600).optional() })
const schema = z.object({
  channel: z.string().regex(/^[a-z0-9-]{1,80}$/).default('annonces'),
  body: z.string().trim().max(8000).default(''),
  kind: z.enum(['post', 'annonce', 'astuce', 'poll', 'event']).default('post'),
  pinned: z.boolean().default(false),
  media: z.array(media).max(10).default([]),
  poll: z.object({ question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(100)).min(2).max(12), multiple: z.boolean().default(false) }).optional(),
  event: z.object({ title: z.string().trim().min(1).max(200), starts_at: z.string().max(40), place: z.string().trim().max(200).optional(), link: z.string().trim().max(500).optional() }).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi.' }, { status: 401 })
  if (!checkRateLimit(`community-post:${user.id}`, 60, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Doucement : réessaie dans un moment.' }, { status: 429 })
  const db = serviceClient()
  const [{ data: allowed }, { data: profile }] = await Promise.all([supabase.rpc('has_community_access'), supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()])
  if (!allowed) return NextResponse.json({ success: false, message: 'Réservé aux membres de la communauté.' }, { status: 403 })
  const admin = !!profile?.is_admin
  const auth = { userId: user.id }
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Publication invalide.' }, { status: 400 })
  const d = parsed.data
  const { data: channel } = await db.from('community_channels').select('id, mode').eq('slug', d.channel).maybeSingle()
  if (!channel) return NextResponse.json({ success: false, message: 'Groupe introuvable.' }, { status: 404 })
  if (!admin && (channel.mode !== 'discussion' || d.kind !== 'post' || d.pinned)) return NextResponse.json({ success: false, message: 'Seul l’administrateur écrit dans ce groupe.' }, { status: 403 })
  if (d.media.some((m) => !m.path.startsWith(`${auth.userId}/`) || m.path.includes('..'))) return NextResponse.json({ success: false, message: 'Fichier invalide.' }, { status: 400 })
  let meta: Record<string, unknown> = {}
  if (d.kind === 'poll') {
    if (!d.poll) return NextResponse.json({ success: false, message: 'Écris la question et au moins 2 réponses.' }, { status: 400 })
    meta = d.poll
  } else if (d.kind === 'event') {
    if (!d.event || Number.isNaN(new Date(d.event.starts_at).getTime())) return NextResponse.json({ success: false, message: 'Donne un titre et une date à l’événement.' }, { status: 400 })
    if (d.event.link && !/^https:\/\//.test(d.event.link)) return NextResponse.json({ success: false, message: 'Le lien doit commencer par https://' }, { status: 400 })
    meta = { ...d.event, starts_at: new Date(d.event.starts_at).toISOString() }
  } else if (!d.body && !d.media.length) {
    return NextResponse.json({ success: false, message: 'Écris un message ou ajoute un fichier.' }, { status: 400 })
  }
  const { data: post, error } = await db.from('community_posts').insert({ channel_id: channel.id, author_id: auth.userId, body: d.body, media: d.media, meta, kind: d.kind, pinned: d.pinned }).select('id').single()
  if (error || !post) return NextResponse.json({ success: false, message: 'Publication impossible.' }, { status: 500 })

  // Notifications : à chaque publication (canal d'annonces), groupées pour ne pas spammer : une seule non lue à la fois.
  const { data: product } = channel.mode === 'annonces' ? await db.from('products').select('id').eq('slug', COMMUNITY_SLUG).maybeSingle() : { data: null }
  if (product) {
    const now = new Date().toISOString()
    const { data: members } = await db.from('entitlements').select('user_id').eq('product_id', product.id).is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${now}`)
    const { data: unread } = await db.from('notifications').select('user_id').eq('product_id', product.id).is('read_at', null)
    const already = new Set((unread ?? []).map((n) => n.user_id as string))
    const ids = [...new Set((members ?? []).map((m) => m.user_id as string))].filter((x) => x !== auth.userId && !already.has(x))
    const title = d.kind === 'poll' ? `📊 Nouveau sondage dans la communauté ${site.name}` : d.kind === 'event' ? `📅 Nouvel événement dans la communauté ${site.name}` : `📣 Nouveau message dans la communauté ${site.name}`
    const body = (d.kind === 'poll' ? d.poll?.question : d.kind === 'event' ? d.event?.title : d.body)?.slice(0, 140) || 'Ouvre la communauté pour voir.'
    if (ids.length) await db.from('notifications').insert(ids.map((uid) => ({ user_id: uid, product_id: product.id, title, body, url: '/communaute' })))
  }
  return NextResponse.json({ success: true, id: post.id })
}

// Messages plus anciens d'un groupe (historique complet, page par page) : GET ?channel=slug&before=ISO
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const { data: allowed } = await supabase.rpc('has_community_access')
  if (!allowed) return NextResponse.json({ success: false }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('channel') || ''
  const before = searchParams.get('before') || ''
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || Number.isNaN(new Date(before).getTime())) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: channel } = await db.from('community_channels').select('id').eq('slug', slug).maybeSingle()
  if (!channel) return NextResponse.json({ success: false }, { status: 404 })
  const posts = await loadFeed(db, user.id, channel.id, 60, new Date(before).toISOString())
  return NextResponse.json({ success: true, posts, more: posts.length === 60 })
}
