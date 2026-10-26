import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { refHref, type FeedDetail } from '@/lib/activity/types'

export const dynamic = 'force-dynamic'

/** Détail d'une ligne du fil, chargé à l'ouverture : texte long complet, erreur, informations, lien vers la fiche. */
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return NextResponse.json({ success: false, message: 'Ligne inconnue.' }, { status: 400 })
  const { data, error } = await serviceClient().from('activity_events')
    .select('detail, error, metadata, user_id, ref_table, ref_id').eq('id', id.data).maybeSingle()
  if (error) return NextResponse.json({ success: false, message: 'Lecture impossible.' }, { status: 500 })
  if (!data) return NextResponse.json({ success: false, message: 'Ligne introuvable.' }, { status: 404 })
  const detail: FeedDetail = {
    detail: data.detail,
    error: data.error,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
    href: refHref(data.ref_table && data.ref_id ? { table: data.ref_table, id: data.ref_id } : null, data.user_id),
  }
  return NextResponse.json({ success: true, detail })
}
