'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'

// Tableau de bord SIMPLE (défaut) ou AVANCÉ : même produit, deux niveaux de détail. Rien n'est supprimé : le mode avancé montre simplement plus.
// Choix gardé dans le navigateur. Les entrées de menu `advanced: true` (site.dashboardNav) n'apparaissent qu'en avancé ;
// dans une page : `const { advanced } = useViewMode()` puis `{advanced && <Details />}`.
// Appris de KappGen (retour des testeurs : « trop de boutons ») : voir references/simplicite-interface.md.
export type ViewMode = 'simple' | 'avance'
const CLE = 'view-mode'

type Ctx = { mode: ViewMode; advanced: boolean; setMode: (m: ViewMode) => void }
const ViewModeContext = createContext<Ctx>({ mode: 'simple', advanced: false, setMode: () => {} })

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('simple')           // le serveur et le premier rendu sont toujours en simple : pas de décalage
  useEffect(() => {
    try { if (localStorage.getItem(CLE) === 'avance') setModeState('avance') } catch { /* navigation privée : on reste en simple */ }
  }, [])
  const setMode = useCallback((m: ViewMode) => {
    setModeState(m)
    try { localStorage.setItem(CLE, m) } catch { /* ignoré */ }
  }, [])
  return <ViewModeContext.Provider value={{ mode, advanced: mode === 'avance', setMode }}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  return useContext(ViewModeContext)
}

// Interrupteur « Simple | Avancé » (boutons, jamais de radio natif), à mettre dans l'en-tête, visible sur tous les écrans.
export function ViewModeToggle({ labels = { simple: 'Simple', avance: 'Avancé' } }: { labels?: { simple: string; avance: string } }) {
  const { mode, setMode } = useViewMode()
  return (
    <div role="radiogroup" aria-label="Type de tableau de bord" className="inline-flex rounded-lg border bg-gray-50 p-0.5 text-xs">
      {(['simple', 'avance'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
          className={clsx('rounded-md px-3 py-1 font-medium transition-colors', mode === m ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          {labels[m]}
        </button>
      ))}
    </div>
  )
}
