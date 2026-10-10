import { site } from '@/config/site'

// Logo : le logo rond (site.logo) + le nom, comme dans la barre du site public.
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 font-medium tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={site.logo} alt="" className="h-9 w-9 rounded-full border border-gray-200 object-cover" />
      <span>
        {site.name}
        <span className="text-brand">.</span>
      </span>
    </span>
  )
}
