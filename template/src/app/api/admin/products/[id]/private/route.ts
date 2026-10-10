import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

const schema = z.object({
  group_url: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^https:\/\//.test(v), 'Le lien du groupe doit commencer par https://'),
  welcome_message: z.string().trim().max(4000).optional().nullable().transform((v) => (v ? v : null)),
})

// Infos réservées aux acheteurs : lien du groupe WhatsApp, message d'accueil.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  const db = serviceClient()
  const { error } = await db.from('product_private').upsert({ product_id: id, ...parsed.data }, { onConflict: 'product_id' })
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'product.private_update', { type: 'product', id })
  return NextResponse.json({ success: true })
}
