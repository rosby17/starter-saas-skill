'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Fenêtres de confirmation aux couleurs du site. INTERDITS : confirm(), alert(), prompt() du navigateur.
// Usage : const confirm = useConfirm(); if (!(await confirm({ title: 'Supprimer ?' }))) return

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
  const close = (v: boolean) => { state?.resolve(v); setState(null) }

  useEffect(() => {
    if (!state) return
    confirmButton.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="dialog-title" className="text-lg font-semibold">{state.title}</h2>
            {state.message && <p className="mt-2 text-sm text-gray-600">{state.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => close(false)} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{state.cancelLabel ?? 'Annuler'}</button>
              <button ref={confirmButton} type="button" onClick={() => close(true)} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-hover'}`}>
                {state.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
