import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Card, Badge, EmptyState } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { contactLink, contactChannel } from '@/config/site'

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
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tickets } = await supabase.from('support_tickets').select('id, subject, status, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(20)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-4xl leading-tight">Aide</h1>
        <p className="mt-2 text-gray-600">Une question sur une formation, un paiement ou ton compte ? Je te réponds.</p>
      </header>
      <a href={contactLink()} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-3xl border border-green-200 bg-green-50 p-5 transition-colors hover:border-green-700">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#25D366] text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium text-gray-900">Écris-nous sur {contactChannel()}</span>
          <span className="block text-sm text-gray-600">Le plus rapide pour me joindre.</span>
        </span>
        <span className="text-xl text-green-700" aria-hidden>↗</span>
      </a>
      <Card>
        <h2 className="mb-1 font-semibold">Ou laisse un message ici</h2>
        <p className="mb-4 text-sm text-gray-500">Tu retrouves la réponse dans cette page.</p>
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
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-surface px-4 py-3 text-sm">
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
