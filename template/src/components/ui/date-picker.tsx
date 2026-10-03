'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from '@/lib/utils'

// Calendrier aux couleurs du site. INTERDIT : <input type="date"> (calendrier du navigateur).
// Valeur au format AAAA-MM-JJ, comme un champ date classique.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (v: string) => { const [y, m, d] = v.split('-').map(Number); return y ? new Date(y, (m || 1) - 1, d || 1) : null }

export function DatePicker({ value, onChange, placeholder = 'Choisir une date', min, max }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
}) {
  const selected = parse(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => { const d = selected ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const offset = (view.getDay() + 6) % 7 // semaine commençant le lundi
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  const today = iso(new Date())
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1))
  const outOfRange = (d: string) => (min && d < min) || (max && d > max)

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-gray-400 focus:border-brand focus:outline-none">
        <span className={selected ? '' : 'text-gray-400'}>{selected ? selected.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : placeholder}</span>
        <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM4 8v8h12V8H4z" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Calendrier" className="absolute z-40 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded-lg px-2 py-1 hover:bg-gray-100" aria-label="Mois précédent">‹</button>
            <span className="text-sm font-medium capitalize">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
            <button type="button" onClick={() => shift(1)} className="rounded-lg px-2 py-1 hover:bg-gray-100" aria-label="Mois suivant">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">{DAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const key = iso(d)
              const disabled = !!outOfRange(key)
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => { onChange(key); setOpen(false) }}
                  className={clsx('h-8 rounded-lg text-sm', key === value ? 'bg-brand text-white' : 'hover:bg-gray-100', key === today && key !== value && 'font-semibold text-brand', disabled && 'opacity-30')}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
