'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { site } from '@/config/site'
import { clsx } from '@/lib/utils'
import { Logo } from '@/components/Logo'

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
export function DashboardShell({ email, isAdmin, logout, children }: { email: string; isAdmin: boolean; logout: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="space-y-1 p-3">
      {site.dashboardNav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
            className={clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100')}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[item.icon] || ICONS.list} /></svg>
            {item.label}
          </Link>
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
            <span className="hidden text-sm text-gray-500 sm:inline">{email}</span>
            {logout}
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
