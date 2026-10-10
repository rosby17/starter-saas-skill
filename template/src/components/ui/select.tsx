'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { clsx } from '@/lib/utils'

// Sélecteur aux couleurs du site. INTERDIT d'utiliser <select> : la liste du navigateur ne suit pas la charte.
export type SelectOption = { value: string; label: string; hint?: string }

export function Select({ value, onChange, options, placeholder = 'Choisir…', className, disabled }: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (i: number) => { const o = options[i]; if (o) { onChange(o.value); setOpen(false) } }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      if (!open) { setOpen(true); setActive(Math.max(0, options.findIndex((o) => o.value === value))); return }
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) pick(active); else setOpen(true) }
  }

  return (
    <div ref={root} className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, options.findIndex((o) => o.value === value))) }}
        onKeyDown={onKey}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-gray-400 focus:border-brand focus:outline-none disabled:opacity-50"
      >
        <span className={current ? '' : 'text-gray-400'}>{current?.label ?? placeholder}</span>
        <svg className={clsx('h-4 w-4 text-gray-500 transition-transform', open && 'rotate-180')} viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-64 w-full min-w-48 overflow-auto rounded-xl border border-gray-200 bg-surface p-1 shadow-lg">
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(i) }}
              className={clsx('flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm', i === active && 'bg-gray-100', o.value === value && 'font-medium text-brand')}
            >
              <span>{o.label}{o.hint && <span className="ml-2 text-xs text-gray-400">{o.hint}</span>}</span>
              {o.value === value && <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
