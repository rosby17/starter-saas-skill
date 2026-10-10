import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const LINK_SECONDS = 2 * 60 * 60 // un lien de lecture vaut 2 heures, puis le lecteur en redemande un

/**
 * Lien de lecture d'une vidéo de leçon (stockage privé « videos »). Réservé à un client connecté qui a accès
 * au produit : la leçon est lue avec SA session (RLS), donc introuvable pour qui n'a pas acheté.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'Leçon inconnue.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi pour regarder cette leçon.' }, { status: 401 })
  if (!checkRateLimit(`play:${user.id}`, 120, 60 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de demandes de lecture. Réessaie dans un moment.' }, { status: 429 })
  }

  const { data: lesson } = await supabase.from('lessons').select('video_path').eq('id', id).maybeSingle()
  if (!lesson?.video_path) return NextResponse.json({ success: false, message: 'Vidéo indisponible.' }, { status: 404 })

  const { data, error } = await serviceClient().storage.from('videos').createSignedUrl(lesson.video_path, LINK_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('Lien de lecture impossible :', error?.message)
    return NextResponse.json({ success: false, message: 'Vidéo momentanément indisponible.' }, { status: 502 })
  }
  return NextResponse.json({ success: true, url: data.signedUrl, expiresIn: LINK_SECONDS }, { headers: { 'Cache-Control': 'no-store' } })
}
