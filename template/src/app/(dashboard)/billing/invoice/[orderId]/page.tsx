import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { site } from '@/config/site'
import { PrintButton } from '@/components/PrintButton'

// Facture imprimable (« Imprimer » → « Enregistrer au format PDF »). Visible par le propriétaire de la commande
// ET par un administrateur. Uniquement pour une commande réellement payée.
export default async function InvoicePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()

  const db = serviceClient()
  const { data: order } = await db.from('orders').select('id, user_id, created_at, plan_name, credits, amount_local, currency, payment_method, status').eq('id', orderId).maybeSingle()
  // Même réponse (404) pour « n'existe pas » et « pas à toi » : on ne révèle rien sur les commandes des autres.
  if (!order || order.status !== 'success' || (order.user_id !== user.id && !profile?.is_admin)) notFound()

  const { data: buyer } = await db.auth.admin.getUserById(order.user_id)
  const number = `FAC-${new Date(order.created_at).getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`

  return (
    <main className="mx-auto max-w-2xl bg-white p-10 text-sm text-gray-800 print:p-0">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facture</h1>
          <p className="text-gray-500">{number}</p>
          <p className="text-gray-500">Date : {new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{site.company.legalName}</p>
          <p className="whitespace-pre-line text-gray-500">{site.company.address}</p>
          {site.company.taxId && <p className="text-gray-500">N° fiscal : {site.company.taxId}</p>}
        </div>
      </div>
      <p className="mb-1 text-gray-500">Facturé à</p>
      <p className="mb-8 font-medium">{buyer?.user?.email}</p>
      <table className="mb-8 w-full">
        <thead><tr className="border-b border-gray-300 text-left"><th className="py-2">Description</th><th className="text-right">Montant</th></tr></thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-3">{order.plan_name}<div className="text-xs text-gray-500">{order.credits.toLocaleString('fr-FR')} crédits</div></td>
            <td className="text-right">{Number(order.amount_local).toLocaleString('fr-FR')} {order.currency}</td>
          </tr>
        </tbody>
        <tfoot><tr><td className="pt-4 text-right font-semibold">Total payé</td><td className="pt-4 text-right font-semibold">{Number(order.amount_local).toLocaleString('fr-FR')} {order.currency}</td></tr></tfoot>
      </table>
      <p className="text-gray-500">Moyen de paiement : {order.payment_method}</p>
      <PrintButton />
    </main>
  )
}
