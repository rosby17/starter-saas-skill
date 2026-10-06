import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/DashboardShell'
import { ErrorReporter } from '@/components/monitoring/ErrorReporter'
import { ProviderStatusBanner } from '@/components/monitoring/ProviderStatusBanner'
import { InsufficientCreditsGate } from '@/components/credits/InsufficientCreditsGate'

// Cadre de toutes les pages connectées : menu (config/site.ts), compte, DÉCONNEXION (menu du profil, en haut à droite).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()

  return (
    <DashboardShell email={user.email ?? ''} isAdmin={!!profile?.is_admin}>
      <ErrorReporter />
      <ProviderStatusBanner />
      <InsufficientCreditsGate />
      {children}
    </DashboardShell>
  )
}
