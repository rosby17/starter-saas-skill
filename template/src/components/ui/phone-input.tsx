'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { site } from '@/config/site'
import { clsx } from '@/lib/utils'

// Numéro WhatsApp avec le drapeau et l'indicatif du pays (liste aux couleurs du site, jamais de <select>).
// La valeur reste une seule chaîne « +237 6xx… » ; onCountry renvoie le nom du pays choisi (utile pour pré-remplir « Pays »).
export type PhoneCountry = { code: string; name: string; dial: string }

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'CM', name: 'Cameroun', dial: '237' }, { code: 'CI', name: 'Côte d’Ivoire', dial: '225' }, { code: 'SN', name: 'Sénégal', dial: '221' },
  { code: 'TG', name: 'Togo', dial: '228' }, { code: 'BJ', name: 'Bénin', dial: '229' }, { code: 'BF', name: 'Burkina Faso', dial: '226' },
  { code: 'ML', name: 'Mali', dial: '223' }, { code: 'NE', name: 'Niger', dial: '227' }, { code: 'GN', name: 'Guinée', dial: '224' },
  { code: 'GA', name: 'Gabon', dial: '241' }, { code: 'CG', name: 'Congo', dial: '242' }, { code: 'CD', name: 'RD Congo', dial: '243' },
  { code: 'TD', name: 'Tchad', dial: '235' }, { code: 'CF', name: 'Centrafrique', dial: '236' }, { code: 'GQ', name: 'Guinée équatoriale', dial: '240' },
  { code: 'MG', name: 'Madagascar', dial: '261' }, { code: 'RW', name: 'Rwanda', dial: '250' }, { code: 'BI', name: 'Burundi', dial: '257' },
  { code: 'KM', name: 'Comores', dial: '269' }, { code: 'DJ', name: 'Djibouti', dial: '253' }, { code: 'MR', name: 'Mauritanie', dial: '222' },
  { code: 'NG', name: 'Nigeria', dial: '234' }, { code: 'GH', name: 'Ghana', dial: '233' }, { code: 'KE', name: 'Kenya', dial: '254' },
  { code: 'MA', name: 'Maroc', dial: '212' }, { code: 'DZ', name: 'Algérie', dial: '213' }, { code: 'TN', name: 'Tunisie', dial: '216' },
  { code: 'ZA', name: 'Afrique du Sud', dial: '27' }, { code: 'HT', name: 'Haïti', dial: '509' },
  { code: 'FR', name: 'France', dial: '33' }, { code: 'BE', name: 'Belgique', dial: '32' }, { code: 'CH', name: 'Suisse', dial: '41' },
  { code: 'CA', name: 'Canada', dial: '1' }, { code: 'US', name: 'États-Unis', dial: '1' }, { code: 'GB', name: 'Royaume-Uni', dial: '44' },
  { code: 'DE', name: 'Allemagne', dial: '49' }, { code: 'IT', name: 'Italie', dial: '39' }, { code: 'ES', name: 'Espagne', dial: '34' },
]

const flag = (code: string) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
const byDial = (v: string) => {
  const digits = v.replace(/[^\d]/g, '')
  if (!v.trim().startsWith('+')) return null
  return [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial)) ?? null
}

// Pays proposé par défaut : site.payments.defaultCountry (src/config/site.ts).
const SITE_COUNTRY = PHONE_COUNTRIES.find((c) => c.name === site.payments.defaultCountry)?.code ?? 'CI'

export function PhoneInput({ value, onChange, onCountry, defaultCountry = SITE_COUNTRY, bare = false, className, placeholder = 'Numéro' }: {
  value: string
  onChange: (value: string) => void
  onCountry?: (name: string) => void
  defaultCountry?: string
  /** Sans bordure ni fond (pour l'insérer dans une ligne de formulaire déjà encadrée). */
  bare?: boolean
  className?: string
  placeholder?: string
}) {
  const detected = byDial(value)
  const [country, setCountry] = useState<PhoneCountry>(detected ?? PHONE_COUNTRIES.find((c) => c.code === defaultCountry) ?? PHONE_COUNTRIES[0])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)

  // Un numéro déjà connu (profil, navigateur) fixe le pays.
  useEffect(() => { if (detected && detected.dial !== country.dial) setCountry(detected) }, [detected, country.dial])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const local = detected ? value.replace(/^\s*\+\s*/, '').replace(/[^\d\s]/g, '').replace(new RegExp(`^\\s*${detected.dial}\\s*`), '') : value.replace(/^\s*\+/, '')
  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '')
    return q ? PHONE_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q)) : PHONE_COUNTRIES
  }, [query])

  const pick = (c: PhoneCountry) => {
    setCountry(c); setOpen(false); setQuery('')
    onChange(`+${c.dial} ${local.trim()}`.trim())
    onCountry?.(c.name)
  }

  return (
    <div ref={root} className={clsx('relative flex items-center', !bare && 'rounded-lg border border-gray-200 bg-surface focus-within:border-brand', className)}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Indicatif : ${country.name} +${country.dial}`}
        className={clsx('flex shrink-0 items-center gap-1.5 text-sm', bare ? 'pr-2' : 'border-r border-gray-200 px-3 py-2.5')}>
        <span className="text-lg leading-none">{flag(country.code)}</span>
        <span className="tabular-nums">+{country.dial}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 opacity-60" fill="currentColor" aria-hidden><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
      </button>
      <input type="tel" inputMode="tel" autoComplete="tel-national" value={local} placeholder={placeholder}
        onChange={(e) => onChange(`+${country.dial} ${e.target.value.replace(/[^\d\s]/g, '')}`.trim())}
        className={clsx('min-w-0 flex-1 bg-transparent outline-none', bare ? 'py-0.5' : 'px-3 py-2.5 text-sm')} />
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-72 w-72 overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-2xl">
          <div className="border-b border-gray-200 p-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un pays ou +indicatif" className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm outline-none" />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {list.map((c) => (
              <li key={c.code}>
                <button type="button" role="option" aria-selected={c.code === country.code} onClick={() => pick(c)}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100', c.code === country.code && 'bg-gray-100 font-medium')}>
                  <span className="text-lg leading-none">{flag(c.code)}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="tabular-nums text-gray-500">+{c.dial}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-2 text-sm text-gray-500">Aucun pays trouvé.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
