import { clientIp } from '@/lib/rate-limit'

// Pays du visiteur côté serveur, pour facturer le prix de sa zone (lib/pricing/zones.ts).
// Le navigateur n'a pas son mot à dire : un pays envoyé par le client serait trop facile à changer.
// 1) en-tête du proxy s'il existe (Cloudflare, Vercel) ; 2) sinon, l'IP interrogée chez geojs (même source que l'affichage).
const cache = new Map<string, { country: string; at: number }>()
const TTL = 6 * 60 * 60_000

export async function visitorCountry(request: Request): Promise<string> {
  const header = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country')
  if (header && /^[A-Z]{2}$/i.test(header) && header.toUpperCase() !== 'XX') return header.toUpperCase()

  const ip = clientIp(request)
  if (!ip || ip === 'inconnue') return ''
  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < TTL) return hit.country
  try {
    const res = await fetch(`https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`, { signal: AbortSignal.timeout(3000), cache: 'no-store' })
    const data = (await res.json()) as { country?: string }
    const country = (data.country || '').toUpperCase()
    if (cache.size > 5000) cache.clear()
    cache.set(ip, { country, at: Date.now() })
    return country
  } catch {
    // Service injoignable : prix de base (FCFA). On ne bloque jamais un achat pour ça.
    return ''
  }
}
