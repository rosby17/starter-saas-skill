'use client'

import { clsx } from '@/lib/utils'

// Petits éléments communs de la page Revenus (cartes, chiffres clés, évolution).

export function Growth({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-xs text-gray-400">—</span>
  return <span className={clsx('text-xs font-medium', value >= 0 ? 'text-green-700' : 'text-red-700')}>{value >= 0 ? '▲ +' : '▼ '}{Math.round(value)} %</span>
}

export function Kpi({ label, value, hint, trend: t, highlight }: { label: string; value: string; hint?: string; trend?: number; highlight?: boolean }) {
  return (
    <div className={clsx('min-w-0 rounded-2xl border bg-surface p-4', highlight ? 'border-brand' : 'border-gray-200')}>
      <p className="truncate text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-medium tracking-tight">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
        {t !== undefined && <Growth value={t} />}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  )
}

export function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-gray-200 bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

