import { requireAdminPage } from '@/lib/auth/admin-page'
import type { Metadata } from 'next'
import { RevenusClient } from './RevenusClient'

export const metadata: Metadata = { title: 'Revenus' }
export const dynamic = 'force-dynamic'

// Administration › Revenus (réservée aux admins par le layout ; chaque route /api/admin/finance/* revérifie).
export default async function RevenusPage() {
  await requireAdminPage()
  return <RevenusClient />
}
