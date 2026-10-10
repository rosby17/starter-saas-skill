import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { site } from '@/config/site'
import { PrintButton } from '@/components/PrintButton'
import { loadInvoice } from '@/lib/invoices/invoice'

// Facture à l'écran (mêmes données que le PDF joint à l'e-mail de paiement). Visible par le propriétaire de la commande
// ET par un administrateur. Uniquement pour une commande réellement payée.
export default async function InvoicePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const db = serviceClient()
  const [{ data: profile }, { data: order }] = await Promise.all([
    db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    db.from('orders').select('user_id').eq('id', orderId).maybeSingle(),
  ])
  // Même réponse (404) pour « n'existe pas » et « pas à toi » : on ne révèle rien sur les commandes des autres.
  if (!order || (order.user_id !== user.id && !profile?.is_admin)) notFound()
  const inv = await loadInvoice(db, orderId)
  if (!inv) notFound()
  const d = (x: Date) => x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const phone = site.whatsapp

  return (
    <main data-theme="light" className="mx-auto my-6 max-w-2xl rounded-2xl border-t-4 border-brand bg-white p-10 text-sm text-gray-800 print:my-0 print:p-0">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-lg font-semibold">{site.name}</p>
          <p className="text-gray-500">Formations de {site.person}</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-brand">FACTURE</h1>
          <p className="font-medium">{inv.number}</p>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-3 gap-4 border-y border-gray-200 py-4">
        <div><p className="text-xs uppercase text-gray-500">Date de la facture</p><p className="font-medium">{d(inv.issuedAt)}</p></div>
        <div><p className="text-xs uppercase text-gray-500">Date du paiement</p><p className="font-medium">{d(inv.paidAt)}</p></div>
        <div><p className="text-xs uppercase text-gray-500">Statut</p><p className="font-semibold text-brand">Payée</p></div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-xs uppercase text-gray-500">Vendeur</p>
          <p className="font-semibold">{site.company.legalName}</p>
          <p className="whitespace-pre-line text-gray-500">{site.name}{'\n'}{site.company.address}{'\n'}{site.supportEmail}{'\n'}{phone}</p>
          {site.company.taxId && <p className="text-gray-500">N° fiscal : {site.company.taxId}</p>}
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-gray-500">Client</p>
          <p className="font-semibold">{inv.customer.name}</p>
          <p className="whitespace-pre-line text-gray-500">{[inv.customer.email, inv.customer.phone, inv.customer.country].filter(Boolean).join('\n')}</p>
        </div>
      </div>
      <table className="mb-6 w-full">
        <thead><tr className="bg-gray-100 text-left text-xs uppercase text-gray-500"><th className="px-3 py-2 font-medium">Description</th><th className="px-3 text-right font-medium">Montant</th></tr></thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.label} className="border-b border-gray-200">
              <td className="px-3 py-3"><p className="font-semibold">{l.label}</p><p className="text-xs text-gray-500">{l.detail}</p></td>
              <td className="px-3 text-right font-medium">{l.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="px-3 pt-4 text-right text-gray-500">Total payé</td><td className="px-3 pt-4 text-right text-lg font-bold">{inv.total}</td></tr></tfoot>
      </table>
      <div className="mb-8 space-y-1">
        <p className="text-xs uppercase text-gray-500">Paiement</p>
        <p>Moyen : <span className="font-medium">{inv.payment.method}</span></p>
        {inv.payment.reference && <p>Référence : <span className="font-medium">{inv.payment.reference}</span></p>}
        {inv.payment.note && <p>Détail : <span className="font-medium">{inv.payment.note}</span></p>}
      </div>
      {inv.kind === 'deposit' && <p className="mb-6 text-brand">Réservation de ta place : le contenu s’ouvre à la sortie de la formation, après paiement du solde (60 % du prix).</p>}
      <div className="flex flex-wrap gap-3 print:hidden">
        <a href={`/api/invoices/${orderId}`} className="rounded-full bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover">Télécharger le PDF</a>
        <PrintButton />
      </div>
    </main>
  )
}
