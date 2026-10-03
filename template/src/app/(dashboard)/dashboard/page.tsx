import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user!.id).maybeSingle()

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour{profile?.first_name ? ` ${profile.first_name}` : ''} 👋</h1>
        <p className="text-sm text-gray-500">Voici ton espace. Ajoute ici les cartes de ton produit.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Mon abonnement</p>
          <Link href="/billing" className="mt-2 inline-block font-medium underline">Voir mon abonnement</Link>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Besoin d'aide ?</p>
          <Link href="/support" className="mt-2 inline-block font-medium underline">Écrire au support</Link>
        </Card>
      </div>
    </main>
  )
}
