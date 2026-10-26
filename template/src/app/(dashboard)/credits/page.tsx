import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getCreditsBalance } from '@/lib/credits/balance'
import { requireModule } from '@/lib/modules'
import { Badge, EmptyState } from '@/components/ui/card'
import { Price } from '@/components/Price'
import { BuyButton } from '@/app/(marketing)/boutique/[slug]/BuyButton'
import { PRODUCT_COLUMNS, currentPrice, type Product } from '@/lib/catalog/types'
import { ALL_SERVICES, isFreeAt, readFreeWindow } from '@/lib/credits/settings'
import { clsx } from '@/lib/utils'

export const metadata: Metadata = { title: 'Crédits' }

const SOURCES: Record<string, string> = {
  purchase: 'Achat', admin_adjustment: 'Ajouté par notre équipe', signup_bonus: 'Bonus de bienvenue', usage: 'Utilisation', expiration: 'Expiration', expiry: 'Expiration',
}

// SaaS à l'usage (module « credits ») : solde, recharge par les packs du catalogue (catégorie « credits », réglés
// dans /admin/products) et historique. Le débit se fait côté serveur avec debitCredits() (lib/credits/balance.ts).
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  requireModule('credits')
  // ?pack=… : le pack recommandé par la carte « Solde faible » est mis en avant.
  const { pack: wanted } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [balance, { data: ledger }, { data: packs }, freeWindow] = await Promise.all([
    getCreditsBalance(serviceClient(), user!.id),
    supabase.from('credits').select('id, amount, source, note, created_at, expires_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('products').select(PRODUCT_COLUMNS).eq('category', 'credits').eq('published', true).order('position'),
    readFreeWindow(serviceClient()),
  ])
  const freeAll = isFreeAt(freeWindow, ALL_SERVICES)
  const freeNow = freeWindow?.until && Date.parse(freeWindow.until) > Date.now() && freeWindow.services.length ? freeWindow : null
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-3xl">Crédits</h1>
        <p className="mt-2 text-gray-600">Chaque utilisation consomme des crédits. Recharge quand tu veux : ils s’ajoutent à ton solde.</p>
      </header>

      {freeNow && (
        <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <strong>Offre en cours : {freeAll ? 'tout est' : `${freeNow.services.join(', ')} ${freeNow.services.length > 1 ? 'sont' : 'est'}`} gratuit</strong>, sans limite, jusqu’au {new Date(freeNow.until!).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. Aucun crédit n’est débité pendant l’offre.
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-surface p-6">
        <p className="text-sm text-gray-500">Ton solde</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{fmt(Math.max(0, balance))} <span className="text-xl font-normal text-gray-500">crédits</span></p>
      </section>

      <section id="packs" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl">Recharger</h2>
        {/* « Crédits à vie » se lisait « illimité à vie » : on dit ce qui se passe vraiment. */}
        <p className="text-sm text-gray-600">Paiement unique, sans abonnement. Chaque utilisation consomme des crédits ; quand ton solde baisse, tu recharges.</p>
        {!packs?.length ? <EmptyState title="Aucun pack de crédits en vente pour l’instant" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(packs as Product[]).map((p) => {
              const price = currentPrice(p)
              const featured = p.slug === wanted
              return (
                <div key={p.id} className={clsx('flex flex-col gap-3 rounded-3xl bg-surface p-5', featured ? 'border-2 border-brand' : 'border border-gray-200')}>
                  {featured && <Badge tone="amber">Recommandé pour toi</Badge>}
                  <p className="text-lg font-medium">{p.title}</p>
                  <p className="text-sm text-gray-500">{fmt(p.credits)} crédits</p>
                  <p className="text-xs text-gray-500">{p.credits_validity_days ? `Valables ${p.credits_validity_days} jours après l’achat.` : 'Sans date d’expiration : tes crédits restent jusqu’à ce que tu les utilises.'}</p>
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
                    <td>{SOURCES[l.source] ?? l.source}{l.note && <span className="block text-xs text-gray-500">{l.note}</span>}</td>
                    <td className="text-right tabular-nums"><Badge tone={l.amount >= 0 ? 'green' : 'gray'}>{l.amount >= 0 ? '+' : ''}{fmt(l.amount)}</Badge></td>
                    <td className="p-3 text-gray-500">{l.amount <= 0 ? '—' : l.expires_at ? `jusqu’au ${new Date(l.expires_at).toLocaleDateString('fr-FR')}` : 'Sans date d’expiration'}</td>
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
