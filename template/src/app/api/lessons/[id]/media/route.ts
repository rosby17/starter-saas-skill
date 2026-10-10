import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { parseBlocks, storagePaths } from '@/lib/course/blocks'

export const dynamic = 'force-dynamic'

const LINK_SECONDS = 2 * 60 * 60

/**
 * Liens signés de TOUS les médias d'une leçon (vidéos de référence, rendus, voix, images des étapes).
 * La leçon est lue avec la session du client (RLS) : introuvable pour qui n'y a pas accès.
 * Seuls les chemins cités par la leçon, dans le dossier de son produit, sont signés.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'Leçon inconnue.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi pour suivre cette leçon.' }, { status: 401 })
  if (!checkRateLimit(`media:${user.id}`, 120, 60 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de demandes. Réessaie dans un moment.' }, { status: 429 })
  }

  const { data: lesson } = await supabase.from('lessons').select('product_id, blocks').eq('id', id).maybeSingle()
  if (!lesson) return NextResponse.json({ success: false, message: 'Leçon indisponible.' }, { status: 404 })

  const paths = storagePaths(parseBlocks(lesson.blocks))
  if (!paths.length) return NextResponse.json({ success: true, urls: {} }, { headers: { 'Cache-Control': 'no-store' } })

  const full = paths.map((p) => `${lesson.product_id}/${p}`)
  const { data, error } = await serviceClient().storage.from('videos').createSignedUrls(full, LINK_SECONDS)
  if (error || !data) {
    console.error('Liens des médias impossibles :', error?.message)
    return NextResponse.json({ success: false, message: 'Médias momentanément indisponibles.' }, { status: 502 })
  }
  const urls: Record<string, string> = {}
  data.forEach((d, i) => { if (d.signedUrl) urls[paths[i]] = d.signedUrl })
  return NextResponse.json({ success: true, urls, expiresIn: LINK_SECONDS }, { headers: { 'Cache-Control': 'no-store' } })
}
