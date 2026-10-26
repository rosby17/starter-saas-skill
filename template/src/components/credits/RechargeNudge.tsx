'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { REASON_LABEL, shouldShowNudge, type Recommendation } from '@/lib/credits/recommend'

// Proposition de recharge au solde faible : une petite carte en bas de l'écran, en teinte d'alerte, qui ne bloque
// rien. Un seul pack mis en avant (celui que le client prend d'habitude, sinon selon sa consommation) ; les autres
// restent à un clic. Pas de fausse réduction, pas de compte à rebours : « Plus tard » la fait taire quelques jours
// (réglable dans Administration › Crédits). Affichages, refus et clics sont suivis (recharge_nudge_events).

type State = { balance: number; threshold: number; snoozedUntil: string | null; recommendation: (Recommendation & { title: string; credits: number }) | null }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.max(0, n))

function track(event: 'shown' | 'dismissed' | 'clicked', pack?: string) {
  void fetch('/api/credits/recharge-nudge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ event, placement: 'banner', pack: pack ?? null }),
  }).catch(() => undefined)
}

export function RechargeNudge() {
  const pathname = usePathname()
  const [state, setState] = useState<State | null>(null)
  const [hidden, setHidden] = useState(false)
  const counted = useRef(false)

  // Relu à chaque changement de page : le solde vient peut-être de baisser après une création.
  useEffect(() => {
    let active = true
    fetch('/api/credits/recharge-nudge', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.success) setState(d) })
      .catch(() => undefined)
    return () => { active = false }
  }, [pathname])

  // La page Crédits montre déjà les packs (le recommandé y est mis en avant) : pas de carte par-dessus.
  const visible = !hidden && !pathname.startsWith('/credits') && shouldShowNudge(state?.balance ?? null, state)
  useEffect(() => {
    if (visible && !counted.current) { counted.current = true; track('shown', state?.recommendation?.pack) }
  }, [visible, state])
  if (!visible || !state) return null

  const rec = state.recommendation
  const dismiss = () => { setHidden(true); track('dismissed') }

  return (
    <aside role="status" aria-label="Solde de crédits faible"
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
      <button type="button" onClick={dismiss} aria-label="Fermer" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
      <p className="flex items-center gap-2 pr-8 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />Solde faible : {fmt(state.balance)} crédits</p>
      <p className="mt-1 text-sm text-gray-600">Recharge maintenant pour ne pas être bloqué au milieu d’un travail. Tes crédits s’ajoutent à ton solde.</p>
      {rec && (
        <Link href={`/credits?pack=${encodeURIComponent(rec.pack)}#packs`} onClick={() => track('clicked', rec.pack)}
          className="group mt-3 flex items-center gap-3 rounded-xl border-2 border-brand bg-surface px-3.5 py-3 hover:bg-gray-50">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-brand">{REASON_LABEL[rec.reason]}</span>
            <span className="block text-sm font-semibold">{rec.title}</span>
            <span className="block text-xs text-gray-500">{fmt(rec.credits)} crédits</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/credits#packs" onClick={() => track('clicked')} className="font-medium text-brand hover:underline">{rec ? 'Autres packs' : 'Voir les packs'}</Link>
        <button type="button" onClick={dismiss} className="ml-auto text-gray-500 hover:text-gray-800">Plus tard</button>
      </div>
    </aside>
  )
}
