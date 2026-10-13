'use client'

import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'

// Bouton thème : UN seul bouton rond. Lune en thème sombre, soleil en thème clair ; un clic bascule.
// Même réglage que le site (localStorage « theme »).
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null)
  useEffect(() => { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark') }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('theme', next) } catch {}
  }

  return (
    <button type="button" onClick={toggle} aria-label={theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}
      className={clsx('grid h-10 w-10 place-items-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:border-brand hover:text-gray-900', className)}>
      {theme === 'light' ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  )
}
