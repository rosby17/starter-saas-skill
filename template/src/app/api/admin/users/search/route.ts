import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

export type UserSearchResult = { id: string; email: string; first_name: string | null; is_admin: boolean; created_at: string }

// Suggestions pendant la frappe (nom ou e-mail), 8 résultats au plus. Fonction SQL admin_search_users
// (migration 20261006120000) : l'e-mail est dans auth.users, invisible pour l'API de données.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const params = new URL(request.url).searchParams
  const q = (params.get('q') || '').trim().slice(0, 120)
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 8))
  const { data, error } = await serviceClient().rpc('admin_search_users', { search: q, max_results: limit })
  if (error) {
    console.error('Recherche d’utilisateurs impossible :', error)
    return NextResponse.json({ success: false, message: 'Recherche impossible (migration admin_user_search appliquée ?).' }, { status: 500 })
  }
  return NextResponse.json({ success: true, users: (data ?? []) as UserSearchResult[] })
}
