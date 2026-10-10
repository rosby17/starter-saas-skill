import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getCreditsBalance } from '@/lib/credits/balance'
import { requireModule } from '@/lib/modules'
import { Badge, EmptyState } from '@/components/ui/card'
import { Price } from '@/components/Price'
import { BuyButton } from '@/app/(marketing)/boutique/[slug]/BuyButton'
import { PRODUCT_COLUMNS, currentPrice, type Product } from '@/lib/catalog/types'

export const metadata: Metadata = { title: 'Crédits' }

const SOURCES: Record<string, string> = {
  purchase: 'Achat', admin_adjustment: 'Ajustement', signup_bonus: 'Bonus de bienvenue', usage: 'Utilisation', expiration: 'Expiration',
}

// SaaS à l'usage (module « credits ») : solde, recharge par les packs du catalogue (catégorie « credits », réglés
// dans /admin/products) et historique. Le débit se fait côté serveur avec debitCredits() (lib/credits/balance.ts).
export default async function CreditsPage() {
  requireModule('credits')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [balance, { data: ledger }, { data: packs }] = await Promise.all([
    getCreditsBalance(serviceClient(), user!.id),
    supabase.from('credits').select('id, amount, source, created_at, expires_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('products').select(PRODUCT_COLUMNS).eq('category', 'credits').eq('published', true).order('position'),
  ])
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-3xl">Crédits</h1>
        <p className="mt-2 text-gray-600">Chaque utilisation consomme des crédits. Recharge quand tu veux : ils s’ajoutent à ton solde.</p>
      </header>

      <section className="rounded-3xl border border-gray-200 bg-surface p-6">
        <p className="text-sm text-gray-500">Ton solde</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{fmt(Math.max(0, balance))} <span className="text-xl font-normal text-gray-500">crédits</span></p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Recharger</h2>
        {!packs?.length ? <EmptyState title="Aucun pack de crédits en vente pour l’instant" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(packs as Product[]).map((p) => {
              const price = currentPrice(p)
              return (
                <div key={p.id} className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-surface p-5">
                  <p className="text-lg font-medium">{p.title}</p>
                  <p className="text-sm text-gray-500">{fmt(p.credits)} crédits{p.credits_validity_days ? ` · valables ${p.credits_validity_days} jours` : ''}</p>
                  {price != null && <p className="text-2xl font-semibold"><Price fcfa={price} /></p>}
                  <div className="mt-auto"><BuyButton slug={p.slug} label="Acheter" /></div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Historique</h2>
        {!ledger?.length ? <EmptyState title="Aucun mouvement pour l’instant" /> : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="p-3">Date</th><th>Mouvement</th><th className="text-right">Crédits</th><th className="p-3">Validité</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="p-3">{new Date(l.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>{SOURCES[l.source] ?? l.source}</td>
                    <td className="text-right tabular-nums"><Badge tone={l.amount >= 0 ? 'green' : 'gray'}>{l.amount >= 0 ? '+' : ''}{fmt(l.amount)}</Badge></td>
                    <td className="p-3 text-gray-500">{l.expires_at ? `jusqu’au ${new Date(l.expires_at).toLocaleDateString('fr-FR')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
