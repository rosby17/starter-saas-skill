'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Select } from '@/components/ui/select'
import { CURRENCIES, FALLBACK_FCFA_PER, compactMoney, formatMoney, fromFcfa, type Currency, type FcfaPer } from '@/lib/finance/money'

// Devise de l'administration : tous les montants de l'admin sont stockés et calculés en FCFA, puis affichés dans la
// devise choisie ici (réglage commun à tous les admins, /api/admin/finance/currency).
// Pour l'appliquer à TOUT l'admin : envelopper {children} de src/app/admin/layout.tsx dans <AdminCurrencyProvider>,
// puis remplacer formatFcfa(n) par useAdminCurrency().format(n) dans les écrans clients ('use client').
// Sans fournisseur au-dessus, useAdminCurrency() affiche en FCFA.

type Ctx = {
  currency: Currency
  fcfaPer: FcfaPer
  format: (fcfa: number) => string
  compact: (fcfa: number) => string
  convert: (fcfa: number) => number
  setCurrency: (c: Currency) => Promise<boolean>
  ready: boolean
}

const make = (currency: Currency, fcfaPer: FcfaPer, setCurrency: Ctx['setCurrency'], ready: boolean): Ctx => ({
  currency, fcfaPer, setCurrency, ready,
  format: (n) => formatMoney(n, currency, fcfaPer),
  compact: (n) => compactMoney(n, currency, fcfaPer),
  convert: (n) => fromFcfa(n, currency, fcfaPer),
})

const CurrencyContext = createContext<Ctx>(make('XAF', FALLBACK_FCFA_PER, async () => false, false))
export const useAdminCurrency = () => useContext(CurrencyContext)

export function AdminCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setState] = useState<Currency>('XAF')
  const [fcfaPer, setRates] = useState<FcfaPer>(FALLBACK_FCFA_PER)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/finance/currency', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive && d.success) { setState(d.currency); setRates(d.fcfaPer) } })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  const setCurrency = useCallback(async (next: Currency) => {
    const previous = currency
    setState(next)
    const res = await fetch('/api/admin/finance/currency', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: next }) })
      .then((r) => r.json()).catch(() => ({ success: false }))
    if (!res.success) setState(previous)
    return !!res.success
  }, [currency])

  const value = useMemo(() => make(currency, fcfaPer, setCurrency, ready), [currency, fcfaPer, setCurrency, ready])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

/** Choix de la devise d'affichage (enregistré pour toute l'administration). */
export function AdminCurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency, fcfaPer } = useAdminCurrency()
  const [error, setError] = useState(false)
  return (
    <div className={className}>
      <Select
        value={currency}
        onChange={async (v) => setError(!(await setCurrency(v as Currency)))}
        options={CURRENCIES.map((c) => ({ value: c.value, label: c.label, hint: c.value === 'XAF' ? undefined : `1 ${c.symbol} = ${Math.round(fcfaPer[c.value])} FCFA` }))}
      />
      {error && <p role="status" className="mt-1 text-xs text-red-700">Devise non enregistrée : réessayez.</p>}
    </div>
  )
}
