import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

// Masquer (ou réafficher) un avis extrême. Jamais de modification du texte ni de la note : seulement visible ou non.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const parsed = z.object({ hidden: z.boolean(), reason: z.string().trim().max(300).optional() }).safeParse(await request.json().catch(() => ({})))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  if (parsed.data.hidden && !parsed.data.reason) return NextResponse.json({ success: false, message: 'Indique le motif (il reste dans le journal).' }, { status: 400 })
  const db = serviceClient()
  await db.from('course_reviews').update({ hidden: parsed.data.hidden, hidden_reason: parsed.data.hidden ? parsed.data.reason : null }).eq('id', id)
  await logAdminAction(db, auth.userId, parsed.data.hidden ? 'review.hide' : 'review.show', { type: 'course_review', id }, { reason: parsed.data.reason })
  return NextResponse.json({ success: true })
}
