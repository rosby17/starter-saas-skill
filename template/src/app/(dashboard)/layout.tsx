import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/LogoutButton'
import { DashboardShell } from '@/components/DashboardShell'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { serviceClient } from '@/lib/auth/service-client'
import { avatarOf } from '@/lib/profile/identity'
import { ErrorReporter } from '@/components/monitoring/ErrorReporter'
import { ProviderStatusBanner } from '@/components/monitoring/ProviderStatusBanner'
import { InsufficientCreditsGate } from '@/components/credits/InsufficientCreditsGate'
import { hasModule } from '@/config/site'

// Cadre de toutes les pages connectées : menu (config/site.ts) ; compte et DÉCONNEXION dans le rond de profil.
// Badge « Pro » tant que le super abonnement court ; « Passer en Pro » proposé à ceux qui ont déjà une formation.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [{ data: profile }, { data: pro }, { data: proOffer }, { data: ents }] = await Promise.all([
    supabase.from('profiles').select('is_admin, full_name, first_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.rpc('has_platform_subscription'),
    supabase.from('products').select('slug, price_fcfa').eq('covers_all', true).eq('published', true).limit(1).maybeSingle(),
    supabase.from('entitlements').select('products(category, billing)').eq('user_id', user.id).is('revoked_at', null).is('expires_at', null),
  ])
  // Le Pro n'est proposé qu'aux élèves qui ont déjà au moins une formation à vie.
  const eligible = ((ents ?? []) as { products: { category: string; billing: string } | { category: string; billing: string }[] | null }[])
    .some((e) => { const p = Array.isArray(e.products) ? e.products[0] : e.products; return p?.category === 'formation' && p.billing !== 'monthly' })
  // Photo : celle de Mon compte, sinon celle de Google (recopiée une fois dans le profil pour la communauté), sinon initiales.
  const meta = user.user_metadata ?? {}
  const avatarUrl = avatarOf(profile?.avatar_url, meta)
  if (!profile?.avatar_url && avatarUrl?.startsWith('https://')) await serviceClient().from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)

  return (
    <DashboardShell
      email={user.email ?? ''}
      name={profile?.full_name || profile?.first_name || (typeof meta.full_name === 'string' ? meta.full_name : '')}
      avatarUrl={avatarUrl}
      isAdmin={!!profile?.is_admin}
      plan={{ pro: pro === true, eligible, offer: proOffer ? { slug: proOffer.slug, price: proOffer.price_fcfa } : null }}
      logout={<LogoutButton className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50" />}
    >
      <ErrorReporter />
      <ProviderStatusBanner />
      {hasModule('credits') && <InsufficientCreditsGate />}
      {children}
      <InstallPrompt />
    </DashboardShell>
  )
}
