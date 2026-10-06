'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { site } from '@/config/site'
import { clsx } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { ViewModeProvider, ViewModeToggle, useViewMode } from '@/components/ViewMode'

const ICONS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
  card: 'M3 7h18v10H3zM3 11h18',
  help: 'M12 17h.01M9.1 9a3 3 0 1 1 4.4 2.6c-.9.5-1.5 1.1-1.5 2.4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  wave: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
  play: 'M6 4l14 8-14 8z',
}

// Menu de gauche (fixe sur ordinateur, tiroir sur téléphone) + bandeau du haut.
// Entrée de menu : `group` la range sous un titre pliable ; `advanced: true` ne l'affiche qu'en tableau de bord Avancé.
type NavItem = { href: string; label: string; icon: string; group?: string; advanced?: boolean }

export function DashboardShell(props: { email: string; isAdmin: boolean; logout: React.ReactNode; children: React.ReactNode }) {
  return <ViewModeProvider><Shell {...props} /></ViewModeProvider>
}

function Shell({ email, isAdmin, logout, children }: { email: string; isAdmin: boolean; logout: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>({})        // groupes repliés (par titre)
  const { advanced } = useViewMode()

  const items = (site.dashboardNav as NavItem[]).filter((i) => advanced || !i.advanced)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const link = (item: NavItem) => (
    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
      className={clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive(item.href) ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100')}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[item.icon] || ICONS.list} /></svg>
      {item.label}
    </Link>
  )
  const groups = Array.from(new Set(items.map((i) => i.group).filter(Boolean))) as string[]

  const nav = (
    <nav className="space-y-1 p-3">
      {items.filter((i) => !i.group).map(link)}
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g)
        const shut = closed[g] && !list.some((i) => isActive(i.href))      // le groupe de la page où l'on est reste ouvert
        return (
          <div key={g} className="pt-2">
            <button type="button" aria-expanded={!shut} onClick={() => setClosed({ ...closed, [g]: !closed[g] })}
              className="flex w-full items-center gap-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600">
              <span className={clsx('transition-transform', shut && '-rotate-90')}>▾</span>{g}
            </button>
            {!shut && list.map(link)}
          </div>
        )
      })}
      {isAdmin && (
        <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50">Administration</Link>
      )}
    </nav>
  )

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="hidden w-60 shrink-0 border-r bg-white md:block">
        <Link href="/dashboard" className="flex h-14 items-center px-5"><Logo /></Link>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white">
            <div className="flex h-14 items-center px-5"><Logo /></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-white px-4">
          <button className="rounded-lg p-2 hover:bg-gray-100 md:hidden" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>
          <div className="ml-auto flex items-center gap-4">
            <ViewModeToggle />
            <span className="hidden text-sm text-gray-500 sm:inline">{email}</span>
            {logout}
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
