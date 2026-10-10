import type { Metadata } from 'next'
import { serviceClient } from '@/lib/auth/service-client'
import { AdminCalls, type AdminBooking } from './AdminCalls'
import { TZ_LABEL } from '@/lib/time'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Appels' }
export const dynamic = 'force-dynamic'

// Agenda des appels : à confirmer en haut, puis les appels confirmés à venir, puis l'historique.
export default async function AdminCallsPage() {
  requireModule('appels')
  const db = serviceClient()
  const { data: bookings } = await db.from('call_bookings').select('id, user_id, status, topic, slots, counter_at, scheduled_at, meet_url, admin_note, created_at').order('created_at', { ascending: false }).limit(200)
  const ids = [...new Set((bookings ?? []).map((b) => b.user_id))]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email, phone').in('id', ids) : { data: [] }
  const who = new Map((profiles ?? []).map((p) => [p.id, p]))
  const rows: AdminBooking[] = (bookings ?? []).map((b) => ({ ...b, name: who.get(b.user_id)?.full_name ?? '—', email: who.get(b.user_id)?.email ?? '', phone: who.get(b.user_id)?.phone ?? '' }))
  const rank = (s: string) => ({ proposed: 0, counter: 1, confirmed: 2, done: 3, cancelled: 4 } as Record<string, number>)[s] ?? 5
  rows.sort((a, b) => rank(a.status) - rank(b.status) || (a.status === 'confirmed' ? String(a.scheduled_at).localeCompare(String(b.scheduled_at)) : 0))
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Appels</h1>
        <p className="mt-1 text-sm text-gray-500">Les clients qui ont payé leur heure proposent jusqu’à 3 créneaux ({TZ_LABEL}). Accepte-en un, ou propose un autre horaire : le client est prévenu par e-mail et dans son espace.</p>
      </header>
      <AdminCalls rows={rows} />
    </main>
  )
}
