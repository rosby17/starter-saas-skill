import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge, EmptyState } from '@/components/ui/card'

const STATUS: Record<string, { label: string; tone: 'gray' | 'green' | 'red' | 'amber' }> = {
  pending: { label: 'En attente', tone: 'amber' }, success: { label: 'Payée', tone: 'green' }, failed: { label: 'Échouée', tone: 'red' },
  expired: { label: 'Expirée', tone: 'gray' }, flagged_underpaid: { label: 'En vérification', tone: 'amber' }, flagged_reversal: { label: 'Remboursée', tone: 'gray' },
}

// Historique des paiements de l'utilisateur + facture des commandes payées. Filtre explicite par user_id :
// un administrateur peut lire (RLS) les commandes de tout le monde.
export default async function BillingHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, plan_name, credits, amount_local, currency, payment_method, status, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Mes paiements</h1>
      {!orders?.length ? <EmptyState title="Aucun paiement pour l'instant" /> : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500"><th className="p-3">Date</th><th>Forfait</th><th>Montant</th><th>Moyen</th><th>Statut</th><th /></tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS[o.status] || { label: o.status, tone: 'gray' as const }
                return (
                  <tr key={o.id} className="border-b border-gray-100">
                    <td className="p-3">{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>{o.plan_name}<div className="text-xs text-gray-400">{o.credits.toLocaleString('fr-FR')} crédits</div></td>
                    <td>{Number(o.amount_local).toLocaleString('fr-FR')} {o.currency}</td>
                    <td>{o.payment_method}</td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="pr-3 text-right">{o.status === 'success' && <Link href={`/billing/invoice/${o.id}`} target="_blank" className="underline">Facture</Link>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
