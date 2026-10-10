import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { reviewEligibility } from '@/lib/reviews/reviews'

// Lien d'envoi de la vidéo du PROJET joint à un avis (élèves vérifiés seulement) : community/<élève>/projet-<aléatoire>-<nom>.
// 100 Mo maximum (le proxy du serveur coupe les envois trop longs).
const schema = z.object({ productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/), filename: z.string().trim().min(1).max(160), type: z.string().max(100), size: z.number().int().min(1) })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi.' }, { status: 401 })
  if (!checkRateLimit(`review-upload:${user.id}`, 10, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Trop d’envois : réessaie dans un moment.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Fichier invalide.' }, { status: 400 })
  const { productSlug, filename, type, size } = parsed.data
  if (!type.startsWith('video/')) return NextResponse.json({ success: false, message: 'Envoie une vidéo (MP4 ou MOV).' }, { status: 400 })
  if (size > 100 * 1024 * 1024) return NextResponse.json({ success: false, message: 'Trop lourd : 100 Mo maximum. Exporte en 1080p ou compresse ta vidéo.' }, { status: 413 })
  const db = serviceClient()
  const { data: product } = await db.from('products').select('id').eq('slug', productSlug).maybeSingle()
  if (!product) return NextResponse.json({ success: false, message: 'Formation introuvable.' }, { status: 404 })
  const can = await reviewEligibility(db, user.id, product.id)
  if (!can.ok) return NextResponse.json({ success: false, message: can.reason }, { status: 403 })
  const safe = filename.normalize('NFD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-60)
  const path = `${user.id}/projet-${crypto.randomUUID().slice(0, 8)}-${safe}`
  const { data, error } = await db.storage.from('community').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ success: false, message: 'Envoi momentanément impossible.' }, { status: 502 })
  return NextResponse.json({ success: true, path, signedUrl: data.signedUrl })
}
