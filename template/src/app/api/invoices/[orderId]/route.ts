import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { invoicePdf, loadInvoice } from '@/lib/invoices/invoice'

// Facture PDF d'une commande payée, pour son propriétaire ou un administrateur. Même 404 pour « inconnue » et « pas à toi ».
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const notFound = () => new NextResponse('Facture introuvable', { status: 404 })
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()
  const db = serviceClient()
  const [{ data: order }, { data: profile }] = await Promise.all([
    db.from('orders').select('user_id').eq('id', orderId).maybeSingle(),
    db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
  ])
  if (!order || (order.user_id !== user.id && !profile?.is_admin)) return notFound()
  const inv = await loadInvoice(db, orderId)
  if (!inv) return notFound()
  const pdf = await invoicePdf(inv)
  return new NextResponse(Buffer.from(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number}.pdf"`, 'Cache-Control': 'private, no-store' },
  })
}
