'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { clsx } from '@/lib/utils'

export type FoundUser = { id: string; email: string; first_name: string | null; is_admin: boolean; created_at: string }

// Recherche d'un compte pour l'administration : suggestions PENDANT la frappe (nom ou e-mail), 8 au plus.
// `already(user)` renvoie un texte (« déjà administrateur »…) pour signaler un compte déjà dans l'état visé.
// Clic (ou Entrée) = sélection. Message clair si aucun compte ne correspond.
export function UserSearch({ onSelect, already, placeholder = 'Rechercher un compte : nom ou e-mail', autoFocus }: {
  onSelect: (user: FoundUser) => void
  already?: (user: FoundUser) => string | null | false | undefined
  placeholder?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Recherche 200 ms après la dernière frappe ; une réponse en retard n'écrase jamais une plus récente.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal })
        const data = await res.json()
        if (data.success) { setResults(data.users); setError(null); setActive(0) }
        else setError(data.message)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Recherche impossible : vérifie ta connexion.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (user: FoundUser | undefined) => {
    if (!user) return
    onSelect(user)
    setQuery(user.email)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (results.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
    }
    if (e.key === 'Enter' && open && results.length) { e.preventDefault(); pick(results[active]) }
  }

  return (
    <div ref={root} className="relative">
      <input value={query} autoFocus={autoFocus} autoComplete="off" spellCheck={false} placeholder={placeholder}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-400" />
      {open && (
        <div id={listId} role="listbox" className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          {error && <p className="px-3 py-2 text-sm text-red-700">{error}</p>}
          {!error && loading && !results.length && <p className="px-3 py-2 text-sm text-gray-500">Recherche…</p>}
          {!error && !loading && !results.length && (
            <p className="px-3 py-2 text-sm text-gray-500">
              {query.trim() ? <>Aucun compte ne correspond à « {query.trim()} ». La personne doit d’abord créer son compte.</> : 'Aucun compte pour l’instant.'}
            </p>
          )}
          {results.map((user, i) => {
            const note = already?.(user)
            return (
              <button key={user.id} type="button" role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(user) }}
                className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', i === active && 'bg-gray-100')}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold uppercase text-gray-600">
                  {(user.first_name || user.email).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{user.first_name || '—'}</span>
                  <span className="block truncate text-xs text-gray-500">{user.email}</span>
                </span>
                {note && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{note}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
