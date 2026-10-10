import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

// Photo de profil (stockage public « avatars », 3 Mo, JPEG/PNG/WebP) :
//   POST   { type, size } → lien d'envoi signé ;   PATCH { path } → la photo devient celle du profil ;
//   DELETE → retour à la photo Google (s'il y en a une) ou aux initiales.
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function POST(request: Request) {
  const { user } = await me()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  if (!checkRateLimit(`avatar:${user.id}`, 10, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Trop d’essais : réessaie plus tard.' }, { status: 429 })
  const parsed = z.object({ type: z.string(), size: z.number().int().min(1) }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || !TYPES[parsed.data.type]) return NextResponse.json({ success: false, message: 'Choisis une image JPEG, PNG ou WebP.' }, { status: 400 })
  if (parsed.data.size > 3 * 1024 * 1024) return NextResponse.json({ success: false, message: 'Image trop lourde : 3 Mo maximum.' }, { status: 413 })
  const path = `${user.id}/${crypto.randomUUID().slice(0, 8)}.${TYPES[parsed.data.type]}`
  const { data, error } = await serviceClient().storage.from('avatars').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ success: false, message: 'Envoi momentanément impossible.' }, { status: 502 })
  return NextResponse.json({ success: true, path, signedUrl: data.signedUrl })
}

export async function PATCH(request: Request) {
  const { user } = await me()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = z.object({ path: z.string().max(200) }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || !parsed.data.path.startsWith(`${user.id}/`) || parsed.data.path.includes('..')) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: old } = await db.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  const url = db.storage.from('avatars').getPublicUrl(parsed.data.path).data.publicUrl
  await db.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  // L'ancienne photo envoyée ici est supprimée (une photo Google, elle, n'est pas chez nous).
  const prev = old?.avatar_url?.split('/avatars/')[1]
  if (prev && prev !== parsed.data.path && prev.startsWith(`${user.id}/`)) await db.storage.from('avatars').remove([prev])
  return NextResponse.json({ success: true, url })
}

export async function DELETE() {
  const { user } = await me()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const db = serviceClient()
  const { data: old } = await db.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  await db.from('profiles').update({ avatar_url: null }).eq('id', user.id)
  const prev = old?.avatar_url?.split('/avatars/')[1]
  if (prev?.startsWith(`${user.id}/`)) await db.storage.from('avatars').remove([prev])
  return NextResponse.json({ success: true })
}
