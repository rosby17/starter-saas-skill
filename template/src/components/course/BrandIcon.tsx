import { siClaude, siDocker, siFfmpeg, siGit, siHomebrew, siNodedotjs, siYoutube, siWhatsapp, siGooglemeet } from 'simple-icons'
import { clsx } from '@/lib/utils'

// Logos OFFICIELS des outils cités dans les leçons (paquet simple-icons, tracés des marques).
// Logos en image : ajouter { nom: '/logos/fichier.png' } dans IMAGES. Outil sans logo connu : initiale, jamais un faux logo.
const BRANDS: Record<string, { path: string; hex: string; title: string }> = {
  claude: siClaude, docker: siDocker, git: siGit, ffmpeg: siFfmpeg, homebrew: siHomebrew, nodejs: siNodedotjs, youtube: siYoutube, whatsapp: siWhatsapp, googlemeet: siGooglemeet,
}
const IMAGES: Record<string, string> = {}

export function BrandIcon({ name, label, className }: { name?: string; label: string; className?: string }) {
  const box = clsx('grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-white', className)
  if (name && IMAGES[name]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={box}><img src={IMAGES[name]} alt="" className="h-full w-full object-cover" /></span>
  }
  const brand = name ? BRANDS[name] : undefined
  if (brand) {
    return (
      <span className={box} title={brand.title}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill={`#${brand.hex}`} aria-hidden><path d={brand.path} /></svg>
      </span>
    )
  }
  return <span className={clsx(box, 'text-lg font-semibold text-gray-700')} aria-hidden>{label.slice(0, 1)}</span>
}
