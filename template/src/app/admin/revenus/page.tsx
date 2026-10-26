import type { Metadata } from 'next'
import { RevenusClient } from './RevenusClient'

export const metadata: Metadata = { title: 'Revenus' }
export const dynamic = 'force-dynamic'

// Administration › Revenus (réservée aux admins par le layout ; chaque route /api/admin/finance/* revérifie).
export default function RevenusPage() {
  return <RevenusClient />
}
