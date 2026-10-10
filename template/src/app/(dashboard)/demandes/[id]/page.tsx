import Link from 'next/link'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/card'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_FORMS, REQUEST_STATUS } from '@/lib/requests'
import { contactLink, contactChannel } from '@/config/site'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Ma demande' }

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  requireModule('demandes')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: r } = await supabase.from('service_requests').select('id, kind, status, answers, admin_reply, created_at, updated_at').eq('id', id).eq('user_id', user!.id).maybeSingle()
  if (!r) notFound()
  const kind = r.kind as RequestKind
  const st = REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'gray' as const }
  const answers = (r.answers ?? {}) as Record<string, string>

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/demandes" className="text-sm text-gray-500 hover:text-gray-900">← Mes demandes</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{REQUEST_KINDS[kind] ?? r.kind}</h1>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="text-sm text-gray-500">Envoyée le {new Date(r.created_at).toLocaleString('fr-FR')}</p>
      </div>

      {r.admin_reply ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="mb-2 text-sm font-medium text-red-700">Notre réponse</p>
          <p className="whitespace-pre-line text-sm">{r.admin_reply}</p>
        </section>
      ) : (
        <p className="rounded-2xl border border-gray-200 bg-surface p-5 text-sm text-gray-600">Ta demande est bien reçue. Je te réponds ici et par e-mail.</p>
      )}

      <section className="rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-lg">Ce que tu as envoyé</h2>
        <dl className="space-y-3 text-sm">
          {(REQUEST_FORMS[kind]?.questions ?? []).filter((q) => answers[q.id]).map((q) => (
            <div key={q.id}>
              <dt className="text-gray-500">{q.label}</dt>
              <dd className="whitespace-pre-line">{answers[q.id]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <WhatsAppButton href={contactLink()} label={`Une précision ? Écris-nous sur ${contactChannel()}`} />
    </main>
  )
}
