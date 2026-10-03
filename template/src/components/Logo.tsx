import { site } from '@/config/site'

// Logo : le fichier site.logo (dans public/) s'il existe, sinon un carré aux couleurs de la marque + le nom du site.
export function Logo({ className = '' }: { className?: string }) {
  if (site.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={site.logo} alt={site.name} className={`h-8 w-auto ${className}`} />
  }
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white shadow-sm">{site.name.slice(0, 1)}</span>
      <span>{site.name}</span>
    </span>
  )
}
