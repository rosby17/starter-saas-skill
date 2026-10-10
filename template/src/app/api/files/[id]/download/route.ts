import { publicOrigin } from '@/lib/site-url'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Téléchargement d'un fichier acheté (stockage privé « files ») : lien signé valable 1 minute, réservé aux acheteurs. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Fichier inconnu.', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?next=/mes-achats', publicOrigin()))
  if (!checkRateLimit(`download:${user.id}`, 30, 60 * 60_000).success) return new NextResponse('Trop de téléchargements. Réessaie plus tard.', { status: 429 })

  const { data: file } = await supabase.from('product_files').select('title, storage_path').eq('id', id).maybeSingle()
  if (!file) return new NextResponse('Fichier introuvable.', { status: 404 })

  const filename = file.storage_path.split('/').pop() || file.title
  const { data, error } = await serviceClient().storage.from('files').createSignedUrl(file.storage_path, 60, { download: filename })
  if (error || !data?.signedUrl) return new NextResponse('Fichier momentanément indisponible.', { status: 502 })
  return NextResponse.redirect(data.signedUrl, { status: 303 })
}
