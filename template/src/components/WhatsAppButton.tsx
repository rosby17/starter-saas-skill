import { siWhatsapp } from 'simple-icons'
import { clsx } from '@/lib/utils'

/** Bouton WhatsApp avec le logo officiel (rond seul, ou avec un libellé). */
export function WhatsAppButton({ phone, href, label, className }: { phone?: string | null; href?: string; label?: string; className?: string }) {
  const url = href ?? (phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}` : null)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label ?? 'Écrire sur WhatsApp'}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white hover:opacity-90', label ? 'px-4 py-2 text-sm font-medium' : 'h-9 w-9', className)}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden><path d={siWhatsapp.path} /></svg>
      {label}
    </a>
  )
}
