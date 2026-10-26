'use client'

import { useState } from 'react'
import { clsx } from '@/lib/utils'
import { useAdminCurrency } from '@/components/admin/AdminCurrency'
import type { Group } from '@/lib/finance/period'

// Barres du chiffre d'affaires de la période (une barre par heure, jour, semaine, mois ou année).
// Graphique maison : aucune dépendance, couleurs de la charte, bulle au survol et au toucher (pas d'infobulle native).

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function bucketLabel(key: string, group: Group, oneDay = true) {
  if (group === 'hour') return `${oneDay ? '' : `${dayLabel(key.slice(0, 10))} `}${Number(key.slice(11, 13))} h`
  if (group === 'year') return key
  if (group === 'month') return new Date(`${key}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  if (group === 'week') return `sem. ${dayLabel(key)}`
  return dayLabel(key)
}

export function RevenueChart({ series, group, oneDay }: { series: { key: string; revenue: number; count: number }[]; group: Group; oneDay: boolean }) {
  const { format, compact } = useAdminCurrency()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...series.map((s) => s.revenue))
  const step = Math.max(1, Math.ceil(series.length / 8)) // au plus ~8 étiquettes sous l'axe
  const point = active !== null ? series[active] : null

  return (
    <div className="space-y-2">
      <div className="flex h-6 items-center text-xs text-gray-500" aria-live="polite">
        {point ? (
          <span>
            <span className="font-medium text-gray-900">{group === 'hour' ? `${bucketLabel(point.key, group, false)} – ${Number(point.key.slice(11, 13)) + 1} h` : bucketLabel(point.key, group)}</span>
            {' · '}{format(point.revenue)} · {point.count} vente{point.count > 1 ? 's' : ''}
          </span>
        ) : <span>Survolez ou touchez une barre pour le détail. Échelle : {compact(max)}</span>}
      </div>
      <div className="flex h-52 items-end gap-px border-b border-gray-200 sm:gap-0.5" onMouseLeave={() => setActive(null)} role="img" aria-label="Chiffre d’affaires de la période">
        {series.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`${bucketLabel(s.key, group, oneDay)} : ${format(s.revenue)}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
          >
            <span
              className={clsx('block w-full rounded-t-sm transition-colors', s.revenue > 0 ? 'bg-brand' : 'bg-gray-200', active === i ? 'opacity-100' : 'opacity-80 group-hover:opacity-100')}
              style={{ height: `${s.revenue > 0 ? Math.max(2, (s.revenue / max) * 100) : 1}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-px text-[10px] text-gray-500 sm:gap-0.5">
        {series.map((s, i) => (
          <span key={s.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">{i % step === 0 ? bucketLabel(s.key, group, oneDay) : ''}</span>
        ))}
      </div>
    </div>
  )
}
