'use client'

import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { clsx } from '@/lib/utils'

// Champ mot de passe avec l'œil pour l'afficher ou le masquer. À utiliser pour TOUT mot de passe.
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={clsx('w-full rounded-lg border border-gray-200 py-2.5 pl-4 pr-11 text-sm outline-none transition-colors focus:border-brand', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-400 transition-colors hover:text-gray-700 focus:text-brand focus:outline-none"
        >
          {visible ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.4M6.6 6.6C4.3 8.1 2.7 10.3 2 12c1 2.5 5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'
