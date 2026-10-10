import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

// Lien d'envoi d'un média de la communauté (membres seulement) : community/<membre>/<aléatoire>-<nom>.
// Images 15 Mo, vidéos 100 Mo (le proxy du serveur coupe les envois trop longs), fichiers et vocaux 25 Mo.
const schema = z.object({ filename: z.string().trim().min(1).max(160), type: z.string().max(100), size: z.number().int().min(1) })
const LIMITS = { image: 15, video: 100, file: 25, audio: 25 }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi.' }, { status: 401 })
  const { data: allowed } = await supabase.rpc('has_community_access')
  if (!allowed) return NextResponse.json({ success: false, message: 'Réservé aux membres de la communauté.' }, { status: 403 })
  if (!checkRateLimit(`community-upload:${user.id}`, 30, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Trop d’envois : réessaie dans un moment.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Fichier invalide.' }, { status: 400 })
  const { filename, type, size } = parsed.data
  const kind = type.startsWith('image/') ? 'image' : type.startsWith('audio/') ? 'audio' : type.startsWith('video/') ? 'video' : 'file'
  if (size > LIMITS[kind] * 1024 * 1024) return NextResponse.json({ success: false, message: `Trop lourd : ${LIMITS[kind]} Mo maximum pour ce type de fichier.` }, { status: 413 })
  const safe = filename.normalize('NFD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80)
  const path = `${user.id}/${crypto.randomUUID().slice(0, 8)}-${safe}`
  const { data, error } = await serviceClient().storage.from('community').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ success: false, message: 'Envoi momentanément impossible.' }, { status: 502 })
  return NextResponse.json({ success: true, path, kind, signedUrl: data.signedUrl })
}
