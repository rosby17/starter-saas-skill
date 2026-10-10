'use client'

import { hasModule } from '@/config/site'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/dialog'

// Le menu ne garde que le quotidien. Les réglages rares (clés, intégrations, moyens de paiement, mise en ligne)
// sont dans « Paramètres », en haut à droite (AdminTopBar).
const NAV = [
  { href: '/admin', label: "Vue d'ensemble", icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { href: '/admin/statistiques', label: 'Statistiques', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { href: '/admin/orders', label: 'Commandes', icon: 'M6 7h12l1 13H5L6 7zM9 7a3 3 0 0 1 6 0' },
  { href: '/admin/customers', label: 'Clients', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.7' },
  { href: '/admin/products', label: 'Formations et produits', icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z' },
  { module: 'appels' as const, href: '/admin/appels', label: 'Appels', icon: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z' },
  { module: 'demandes' as const, href: '/admin/requests', label: 'Devis et coaching', icon: 'M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4v-6z' },
  { href: '/admin/support', label: 'Support', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { module: 'avis' as const, href: '/admin/avis-formations', label: 'Avis des formations', icon: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z' },
  { href: '/admin/feedbacks', label: 'Suggestions', icon: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z' },
  { href: '/admin/announcements', label: 'Annonces', icon: 'M3 11l15-6v14L3 13zM7 13v5a2 2 0 0 0 4 0v-3' },
]

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}

// Menu de l'administration : colonne aérée sur ordinateur, bande défilante sur téléphone.
export function AdminNav({ newRequests }: { newRequests: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible md:px-4">
      {NAV.filter((item) => !('module' in item) || !item.module || hasModule(item.module)).map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link key={item.href} href={item.href}
            className={clsx('flex shrink-0 items-center gap-3.5 whitespace-nowrap rounded-2xl px-4 py-3 text-[15px] transition-colors',
              active ? 'bg-brand/10 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
            <span className={clsx('hidden md:inline', active ? 'text-brand' : 'text-gray-500')}><Icon d={item.icon} /></span>
            {item.label}
            {item.href === '/admin/requests' && newRequests > 0 && (
              <span className="ml-auto rounded-full bg-brand px-2 text-xs text-white">{newRequests}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

/** Interrupteur du mode maintenance, en bas du menu (confirmation avant de couper le site). */
export function MaintenanceSwitch() {
  const confirm = useConfirm()
  const [on, setOn] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    createClient().from('system_settings').select('value').eq('key', 'maintenance').maybeSingle()
      .then(({ data }) => setOn((data?.value as { enabled?: boolean } | undefined)?.enabled === true))
  }, [])

  const toggle = async () => {
    const next = !on
    if (next && !(await confirm({ title: 'Mettre le site en maintenance ?', message: 'Tous les visiteurs (sauf toi) verront la page de maintenance jusqu’à ce que tu la coupes.', confirmLabel: 'Activer', danger: true }))) return
    setSaving(true)
    const { error } = await createClient().from('system_settings').upsert({ key: 'maintenance', value: { enabled: next } })
    if (!error) setOn(next)
    setSaving(false)
  }

  return (
    <button type="button" role="switch" aria-checked={!!on} onClick={toggle} disabled={on === null || saving}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">
      <span className="min-w-0 flex-1">
        Maintenance
        <span className={clsx('block text-xs', on ? 'text-red-700' : 'text-gray-500')}>{on === null ? '…' : on ? 'Site fermé aux visiteurs' : 'Site ouvert'}</span>
      </span>
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-red-600' : 'bg-gray-300')}>
        <span className={clsx('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}
