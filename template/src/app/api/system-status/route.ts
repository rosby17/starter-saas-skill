import { NextResponse } from 'next/server'
import { isProviderDegraded } from '@/lib/monitoring/provider-status'

// Public et minimal : un seul booléen, aucune donnée client.
export async function GET() {
  return NextResponse.json({ providerDegraded: await isProviderDegraded() }, { headers: { 'Cache-Control': 'no-store' } })
}
