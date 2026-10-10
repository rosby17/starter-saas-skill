'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { site, contactLink, hasModule, contactChannel } from '@/config/site'
import { clsx } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { ProfileMenu } from '@/components/ProfileMenu'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { formatFcfa } from '@/lib/catalog/types'
import { ProBadge } from '@/components/ProBadge'
import { NotificationBell } from '@/components/NotificationBell'
import { Shield } from 'lucide-react'

const ICONS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z',
  bag: 'M6 7h12l1 13H5L6 7zM9 7a3 3 0 0 1 6 0',
  inbox: 'M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4v-6z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  help: 'M12 17h.01M9.1 9a3 3 0 1 1 4.4 2.6c-.9.5-1.5 1.1-1.5 2.4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  play: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z',
  shop: 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.7',
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] || ICONS.list} />
    </svg>
  )
}

export type Plan = { pro: boolean; eligible: boolean; offer: { slug: string; price: number | null } | null }

// Espace client : menu de gauche aéré (fixe sur ordinateur, tiroir sur téléphone), formule Gratuit / Pro,
// aide WhatsApp en un clic ; en haut : thème clair / sombre et rond de profil (compte, administration, déconnexion).
export function DashboardShell({ email, name, avatarUrl, isAdmin, plan, logout, children }: {
  email: string; name: string; avatarUrl: string | null; isAdmin: boolean; plan: Plan; logout: React.ReactNode; children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const side = (
    <div className="flex h-full flex-col">
      <nav className="space-y-1 px-4 py-2">
        {site.dashboardNav.filter((item) => !item.module || hasModule(item.module)).map((item) => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/mes-achats' && pathname.startsWith('/cours/'))
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={clsx('flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] transition-colors',
                active ? 'bg-brand/10 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
              <span className={clsx(active ? 'text-brand' : 'text-gray-500')}><Icon name={item.icon} /></span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3 p-4">
        {plan.pro ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><ProBadge size="sm" /> Membre Pro</p>
            <p className="mt-1.5 text-xs leading-5 text-gray-600">Tu restes à jour : chaque nouveau module de tes formations, dès sa sortie.</p>
          </div>
        ) : plan.offer && plan.eligible && (
          <Link href={`/dashboard/offres/${plan.offer.slug}`} onClick={() => setOpen(false)} className="group block rounded-2xl border border-gray-200 bg-gray-100/60 p-4 hover:border-brand">
            <p className="flex items-center gap-2 text-sm font-medium">Passer en <ProBadge size="sm" /></p>
            <p className="mt-1.5 text-xs leading-5 text-gray-600">L’IA va vite : reste à jour de toutes tes formations{plan.offer.price ? `, ${formatFcfa(plan.offer.price)} par mois` : ''}.</p>
            <span className="mt-2 inline-block text-xs font-medium text-brand group-hover:underline">Découvrir →</span>
          </Link>
        )}
        <a href={contactLink()} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:border-gray-300 hover:text-gray-900">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-green-700" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
          <span className="min-w-0 flex-1">Une question ?<span className="block text-xs text-gray-500">Écris-nous sur {contactChannel()}</span></span>
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-surface md:flex">
        <Link href="/dashboard" className="flex h-20 items-center px-7"><Logo /></Link>
        {side}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-surface">
            <div className="flex h-20 items-center px-7"><Logo /></div>
            {side}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-gray-50/80 px-4 backdrop-blur md:h-20 md:px-8">
          <button className="rounded-lg p-2 hover:bg-gray-100 md:hidden" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitch />
            {isAdmin && (
              <Link href="/admin" className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:border-brand hover:text-gray-900">
                <Shield className="h-4 w-4" strokeWidth={1.8} /><span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            {plan.pro && <ProBadge className="hidden sm:inline-flex" />}
            <NotificationBell />
            <ProfileMenu name={name} email={email} avatarUrl={avatarUrl} isAdmin={isAdmin} pro={plan.pro} logout={logout} />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
