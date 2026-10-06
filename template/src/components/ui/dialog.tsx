'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Fenêtres de confirmation et d'information aux couleurs du site (clair ET sombre).
// INTERDITS partout (site, espace client, admin) : confirm(), alert(), prompt() du navigateur.
// Usage :
//   const confirm = useConfirm(); if (!(await confirm({ title: 'Supprimer ce projet ?', message: '…', confirmLabel: 'Supprimer', danger: true }))) return
//   const inform = useInform(); await inform({ title: 'Lien copié' })          // remplace alert()
// Clavier : Échap = Annuler, Entrée = bouton principal, Tab reste dans la fenêtre ; le focus revient ensuite où il était.

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
type InformOptions = { title: string; message?: string; okLabel?: string }
type State = ConfirmOptions & { resolve: (v: boolean) => void; informOnly?: boolean }

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)
const InformContext = createContext<(o: InformOptions) => Promise<void>>(async () => {})

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null)
  const current = useRef<State | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const previous = useRef<HTMLElement | null>(null)

  const open = useCallback((s: State) => {
    previous.current = document.activeElement as HTMLElement | null
    current.current = s
    setState(s)
  }, [])
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => open({ ...o, resolve })), [open])
  const inform = useCallback((o: InformOptions) => new Promise<void>((resolve) =>
    open({ title: o.title, message: o.message, confirmLabel: o.okLabel ?? 'OK', informOnly: true, resolve: () => resolve() })), [open])
  const close = useCallback((v: boolean) => {
    const s = current.current
    current.current = null
    setState(null)
    s?.resolve(v)
    previous.current?.focus?.()
  }, [])

  useEffect(() => {
    if (!state) return
    confirmButton.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'Enter') { e.preventDefault(); close(true) }
      else if (e.key === 'Tab' && box.current) {        // focus piégé dans la fenêtre
        const items = Array.from(box.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'))
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      <InformContext.Provider value={inform}>
        {children}
        {state && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={() => close(false)}>
            <div ref={box} role={state.informOnly ? 'dialog' : 'alertdialog'} aria-modal="true" aria-labelledby="dialog-title" aria-describedby={state.message ? 'dialog-text' : undefined}
              className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100" onMouseDown={(e) => e.stopPropagation()}>
              <h2 id="dialog-title" className="text-lg font-semibold">{state.title}</h2>
              {state.message && <p id="dialog-text" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{state.message}</p>}
              <div className="mt-6 flex justify-end gap-2">
                {!state.informOnly && (
                  <button type="button" onClick={() => close(false)} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{state.cancelLabel ?? 'Annuler'}</button>
                )}
                <button ref={confirmButton} type="button" onClick={() => close(true)} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-hover'}`}>
                  {state.confirmLabel ?? 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </InformContext.Provider>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
export const useInform = () => useContext(InformContext)
