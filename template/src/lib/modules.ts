import { notFound } from 'next/navigation'
import { hasModule, type ModuleId } from '@/config/site'

/** Page d'un module coupé dans site.ts : « page introuvable », comme si elle n'existait pas. */
export function requireModule(id: ModuleId): void {
  if (!hasModule(id)) notFound()
}
