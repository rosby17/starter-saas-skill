import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

// Demandes des clients : GET /api/admin/requests?status=nouvelle&kind=projet
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const kind = searchParams.get('kind') || ''
  const db = serviceClient()
  let query = db.from('service_requests').select('id, kind, status, created_at, updated_at, admin_reply, user_id').order('created_at', { ascending: false }).limit(200)
  if (['nouvelle', 'en_cours', 'terminee', 'annulee'].includes(status)) query = query.eq('status', status)
  if (/^[a-z-]{1,40}$/.test(kind)) query = query.eq('kind', kind)
  const { data: rows, error } = await query
  if (error) return NextResponse.json({ success: false, message: 'Lecture des demandes impossible.' }, { status: 500 })
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email, phone').in('id', ids) : { data: [] }
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
  return NextResponse.json({ success: true, requests: (rows ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null })) })
}
