import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { callCredits } from '@/lib/calls/credits'
import { CALL_SLUG } from '@/lib/calls/slots'
import { CallsView, type Booking } from './CallsView'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Appels' }
export const dynamic = 'force-dynamic'

// Réservation de l'heure d'échange : le client propose ses créneaux, l'administrateur confirme ou propose un autre horaire.
export default async function CallsPage() {
  requireModule('appels')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/appels')
  const db = serviceClient()
  const [{ left, paid }, { data: bookings }] = await Promise.all([
    callCredits(db, user.id),
    supabase.from('call_bookings').select('id, status, topic, slots, counter_at, scheduled_at, meet_url, admin_note, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Tes appels</h1>
        <p className="mt-1 text-gray-500">Une heure rien que pour toi, en visio ou sur WhatsApp. Propose tes créneaux : je confirme ou je t’en propose un autre.</p>
      </header>
      {paid === 0 && !(bookings ?? []).length ? (
        <div className="rounded-3xl border border-gray-200 bg-surface p-8 text-center">
          <p className="text-lg">Tu n’as pas encore d’heure d’échange.</p>
          <Link href={`/dashboard/offres/${CALL_SLUG}`} className="mt-4 inline-flex rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover">Réserver une heure avec moi</Link>
        </div>
      ) : (
        <CallsView bookings={(bookings ?? []) as Booking[]} left={left} />
      )}
    </main>
  )
}
