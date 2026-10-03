import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Card, Badge, EmptyState } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

async function createTicket(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const subject = String(formData.get('subject') || '').trim().slice(0, 140)
  const message = String(formData.get('message') || '').trim().slice(0, 4000)
  if (!subject || !message) return
  await supabase.from('support_tickets').insert({ user_id: user.id, subject, message })
  revalidatePath('/support')
}

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: tickets } = await supabase.from('support_tickets').select('id, subject, status, created_at').order('created_at', { ascending: false }).limit(20)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Aide</h1>
      <Card>
        <h2 className="mb-4 font-semibold">Écrire au support</h2>
        <form action={createTicket} className="space-y-3">
          <Input name="subject" placeholder="Sujet" required maxLength={140} />
          <textarea name="message" required maxLength={4000} rows={5} placeholder="Explique ton problème" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <Button type="submit">Envoyer</Button>
        </form>
      </Card>
      <section>
        <h2 className="mb-3 font-semibold">Mes demandes</h2>
        {!tickets?.length ? <EmptyState title="Aucune demande pour l'instant" /> : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                <span>{t.subject}</span>
                <Badge tone={t.status === 'closed' ? 'green' : 'amber'}>{t.status === 'closed' ? 'Résolue' : 'En cours'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
