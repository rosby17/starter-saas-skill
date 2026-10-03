'use client'

import { clsx } from '@/lib/utils'

// Remplacent les boutons radio et cases à cocher du navigateur (INTERDITS) : mêmes rôles d'accessibilité, style du site.

export function RadioCard({ checked, onSelect, label, description, extra }: {
  checked: boolean
  onSelect: () => void
  label: string
  description?: string
  extra?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={clsx('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors', checked ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300')}
    >
      <span className={clsx('grid h-4 w-4 shrink-0 place-items-center rounded-full border-2', checked ? 'border-brand' : 'border-gray-300')}>
        {checked && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      <span className="font-medium">{label}</span>
      {description && <span className="text-gray-500">{description}</span>}
      {extra && <span className="ml-auto">{extra}</span>}
    </button>
  )
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-2 text-left text-sm">
      <span className={clsx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 transition-colors', checked ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white')}>
        {checked && <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
      </span>
      <span>{label}</span>
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={clsx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-gray-300')}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}
