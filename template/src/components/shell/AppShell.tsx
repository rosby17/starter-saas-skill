'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/Logo'
import { clsx } from '@/lib/utils'
import { NavIcon } from './icons'

// Cadre commun de l'espace client et de l'administration.
//  ≥ 900 px : menu complet à gauche (240 px).
//  560–899 px : rail d'icônes (64 px) + bouton ☰ en haut qui ouvre le menu COMPLET avec les noms.
//  < 560 px : plus de rail, contenu pleine largeur, ☰ toujours visible en haut.
// Sous 900 px : flèche ← quand on n'est pas sur l'accueil, titre = nom de la page.
// Le tiroir (272 px + voile) se ferme par un lien, le voile, Échap ou un changement de page.

export type NavItem = { href: string; label: string; icon: string; group?: string; advanced?: boolean }

export function AppShell({ items, homeHref, sectionLabel, email, isAdmin, headerExtra, footerLink, children }: {
  items: NavItem[]
  homeHref: string
  /** Titre affiché au-dessus du menu (ex. « Administration »). */
  sectionLabel?: string
  email: string
  isAdmin: boolean
  headerExtra?: React.ReactNode
  /** Lien en bas du menu (ex. « Administration » côté client, « ← Mon espace » côté admin). */
  footerLink?: { href: string; label: string; tone?: 'amber' | 'gray' }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>({}) // groupes repliés (par titre)

  // Tout changement de page referme le tiroir.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const matches = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`))
  // La page courante = l'entrée la plus précise qui correspond (ex. /admin/users plutôt que /admin).
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => matches(i.href))
  const isActive = (href: string) => current?.href === href
  const atHome = pathname === homeHref
  const title = current?.label ?? sectionLabel ?? ''

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(homeHref)
  }

  const groups = Array.from(new Set(items.map((i) => i.group).filter(Boolean))) as string[]

  // compact = rail d'icônes (libellés lus par les lecteurs d'écran seulement) ; jamais dans le tiroir.
  const nav = (compact: boolean) => {
    const label = compact ? 'max-[899px]:sr-only' : ''
    const link = (item: NavItem) => (
      <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(item.href) ? 'page' : undefined}
        className={clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', compact && 'max-[899px]:justify-center max-[899px]:px-0',
          isActive(item.href) ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100')}>
        <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
        <span className={label}>{item.label}</span>
      </Link>
    )
    return (
      <nav className="space-y-1 p-3" aria-label={sectionLabel ?? 'Menu'}>
        {items.filter((i) => !i.group).map(link)}
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g)
          const shut = closed[g] && !list.some((i) => isActive(i.href)) // le groupe de la page où l'on est reste ouvert
          return (
            <div key={g} className="pt-2">
              <button type="button" aria-expanded={!shut} onClick={() => setClosed({ ...closed, [g]: !closed[g] })}
                className={clsx('flex w-full items-center gap-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600', compact && 'max-[899px]:hidden')}>
                <span className={clsx('transition-transform', shut && '-rotate-90')}>▾</span>{g}
              </button>
              {/* Replié : caché dans le tiroir et le menu complet, toujours visible dans le rail d'icônes (sans titres de groupe). */}
              <div className={shut ? (compact ? 'min-[900px]:hidden' : 'hidden') : undefined}>{list.map(link)}</div>
            </div>
          )
        })}
        {footerLink && (
          <Link href={footerLink.href} onClick={() => setOpen(false)}
            className={clsx('mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm', compact && 'max-[899px]:justify-center max-[899px]:px-0',
              footerLink.tone === 'amber' ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-600 hover:bg-gray-100')}>
            <NavIcon name={footerLink.tone === 'amber' ? 'shield' : 'home'} className="h-4 w-4 shrink-0" />
            <span className={label}>{footerLink.label}</span>
          </Link>
        )}
      </nav>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 min-[560px]:flex">
      {/* Menu fixe : rail d'icônes de 560 à 899 px, menu complet à partir de 900 px. */}
      <aside className="sticky top-0 hidden h-screen print:!hidden shrink-0 overflow-y-auto border-r border-gray-200 bg-white min-[560px]:block min-[560px]:w-16 min-[900px]:w-60">
        <Link href={homeHref} className="hidden h-14 items-center px-5 min-[900px]:flex"><Logo /></Link>
        <div className="h-14 min-[900px]:hidden" aria-hidden />
        {sectionLabel && <p className="hidden px-6 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 min-[900px]:block">{sectionLabel}</p>}
        {nav(true)}
      </aside>

      {/* Tiroir : menu complet avec les noms des pages (sous 900 px). */}
      {open && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label="Menu" className="absolute left-0 top-0 h-full w-[272px] max-w-[85vw] overflow-y-auto bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-5">
              <Link href={homeHref} onClick={() => setOpen(false)}><Logo /></Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-9 w-9 place-items-center rounded-lg text-xl text-gray-500 hover:bg-gray-100">×</button>
            </div>
            {sectionLabel && <p className="px-6 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{sectionLabel}</p>}
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-2 sm:gap-2 sm:px-4">
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl hover:bg-gray-100 min-[900px]:hidden" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
          {!atHome && (
            <button type="button" onClick={goBack} aria-label="Retour" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl hover:bg-gray-100 min-[900px]:hidden">←</button>
          )}
          <p className="min-w-0 truncate font-semibold min-[900px]:hidden">{title}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            {headerExtra}
            <ProfileMenu email={email} isAdmin={isAdmin} />
          </div>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

/** Menu du profil (avatar) : compte, administration et clés pour l'admin, déconnexion. */
export function ProfileMenu({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const entry = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Mon profil"
        className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold uppercase text-white ring-offset-2 hover:ring-2 hover:ring-gray-300">
        {(email || '?').slice(0, 1)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-gray-500">{email}</p>
          <Link role="menuitem" href="/settings" className={entry}><NavIcon name="user" />Mon compte</Link>
          {isAdmin && <>
            <Link role="menuitem" href="/admin" className={entry}><NavIcon name="shield" />Administration</Link>
            <Link role="menuitem" href="/admin/keys" className={entry}><NavIcon name="key" />Clés et intégrations</Link>
          </>}
          <div className="my-1 h-px bg-gray-100" />
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className={entry}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></svg>
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
