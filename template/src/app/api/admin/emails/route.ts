import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

// Journal des derniers e-mails (table email_log) : résultat et, en cas d'échec, la réponse du fournisseur. Paginé.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const page = Math.max(0, Number(new URL(request.url).searchParams.get('page')) || 0)
  const { data, error } = await serviceClient().from('email_log')
    .select('id, created_at, to_email, subject, template, status, provider_status, provider_response, is_example')
    .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  if (error) return NextResponse.json({ success: false, message: 'Journal illisible (migration email_log appliquée ?).' }, { status: 500 })
  const rows = data ?? []
  return NextResponse.json({ success: true, emails: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE })
}
