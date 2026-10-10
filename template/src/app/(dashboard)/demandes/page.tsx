import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Badge, EmptyState } from '@/components/ui/card'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_STATUS } from '@/lib/requests'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Devis et coaching' }

export default async function RequestsPage() {
  requireModule('demandes')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: requests } = await supabase.from('service_requests').select('id, kind, status, created_at, updated_at, admin_reply').eq('user_id', user!.id).order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">Devis et coaching</h1>
          <p className="mt-1 text-sm text-gray-500">Tes demandes de coaching, d’accompagnement ou de devis (site, SaaS, design) : suis l’avancement ici.</p>
        </div>
        <Link href="/demandes/nouvelle" className="ml-auto rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Demander un devis</Link>
      </div>
      {!requests?.length ? (
        <EmptyState title="Aucune demande pour l’instant" text="Création de site ou de SaaS, design, accompagnement, monétisation bloquée : fais ta demande, je te réponds ici." />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const st = REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'gray' as const }
            return (
              <li key={r.id}>
                <Link href={`/demandes/${r.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-4 hover:border-brand">
                  <span className="font-medium">{REQUEST_KINDS[r.kind as RequestKind] ?? r.kind}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {r.admin_reply && <span className="text-xs text-brand">Réponse reçue</span>}
                  <span className="ml-auto text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
