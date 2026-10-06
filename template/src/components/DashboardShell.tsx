'use client'

import { site } from '@/config/site'
import { AppShell, type NavItem } from '@/components/shell/AppShell'
import { ViewModeProvider, ViewModeToggle, useViewMode } from '@/components/ViewMode'

// Cadre de l'espace client : menu `site.dashboardNav` (config/site.ts), bandeau du haut, menu du profil (avatar)
// avec « Mon compte », l'administration pour l'admin et la déconnexion (POST /auth/signout).
// Mise en page selon la largeur : voir components/shell/AppShell.tsx (menu complet, rail d'icônes, tiroir ☰).
// Entrée de menu : `group` la range sous un titre pliable ; `advanced: true` ne l'affiche qu'en tableau de bord Avancé.
export function DashboardShell(props: { email: string; isAdmin: boolean; children: React.ReactNode }) {
  return <ViewModeProvider><Shell {...props} /></ViewModeProvider>
}

function Shell({ email, isAdmin, children }: { email: string; isAdmin: boolean; children: React.ReactNode }) {
  const { advanced } = useViewMode()
  const items = (site.dashboardNav as NavItem[]).filter((i) => advanced || !i.advanced)
  return (
    <AppShell items={items} homeHref="/dashboard" email={email} isAdmin={isAdmin}
      headerExtra={<ViewModeToggle />}
      footerLink={isAdmin ? { href: '/admin', label: 'Administration', tone: 'amber' } : undefined}>
      {children}
    </AppShell>
  )
}
