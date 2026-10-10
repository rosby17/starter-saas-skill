import { Crown } from 'lucide-react'
import { clsx } from '@/lib/utils'

// Badge des abonnés Pro : pastille rouge de la charte, couronne et reflet qui passe lentement.
export function ProBadge({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={clsx('pro-badge relative inline-flex items-center gap-1 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-hover font-semibold uppercase tracking-[0.12em] text-white shadow-[0_6px_18px_-8px_var(--color-brand)] ring-1 ring-white/20',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs', className)}>
      <Crown className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.2} aria-hidden />
      Pro
    </span>
  )
}
