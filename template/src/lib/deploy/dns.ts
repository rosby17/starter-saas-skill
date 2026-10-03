import { callJson, DeployError } from './http'

// Fournisseurs de noms de domaine. Ajouter un fournisseur = un objet de plus qui implémente DnsProvider.
export interface DnsProvider {
  id: 'hostinger' | 'cloudflare'
  /** Fait pointer domaine.com (A), www.domaine.com (CNAME) et api.domaine.com (A, la base de données) vers le serveur. */
  pointToServer(domain: string, ip: string): Promise<void>
}

// --- Hostinger (hPanel > Compte > API : jeton). Sait aussi vérifier et acheter un domaine.
const HAPI = 'https://developers.hostinger.com/api'

export function hostinger(token: string): DnsProvider & {
  checkAvailability(domain: string): Promise<{ available: boolean; price: { id: string; amount: number; currency: string } | null }>
  buyDomain(domain: string, priceId: string): Promise<void>
} {
  return {
    id: 'hostinger',
    async pointToServer(domain, ip) {
      // Retire les adresses de la page de parking (A et AAAA) puis pose les nôtres.
      await callJson('Hostinger', `${HAPI}/dns/v1/zones/${domain}`, token, {
        method: 'DELETE',
        body: { filters: [{ name: '@', type: 'AAAA' }, { name: 'www', type: 'A' }, { name: 'www', type: 'AAAA' }, { name: 'api', type: 'AAAA' }, { name: 'api', type: 'CNAME' }] },
        okStatuses: [404, 422],
      })
      await callJson('Hostinger', `${HAPI}/dns/v1/zones/${domain}`, token, {
        method: 'PUT',
        body: {
          overwrite: true,
          zone: [
            { name: '@', type: 'A', ttl: 300, records: [{ content: ip }] },
            { name: 'www', type: 'CNAME', ttl: 300, records: [{ content: `${domain}.` }] },
            { name: 'api', type: 'A', ttl: 300, records: [{ content: ip }] },
          ],
        },
      })
    },
    async checkAvailability(domain) {
      const [label, ...tld] = domain.split('.')
      const result = await callJson<Array<{ domain: string; is_available: boolean }>>('Hostinger', `${HAPI}/domains/v1/availability`, token, {
        method: 'POST',
        body: { domain: label, tlds: [tld.join('.')], with_alternatives: false },
      })
      const available = result.some((r) => r.domain === domain && r.is_available)
      if (!available) return { available, price: null }
      const catalog = await callJson<Array<{ prices: Array<{ id: string; price: number; first_period_price: number; currency: string; period: number; period_unit: string }> }>>(
        'Hostinger', `${HAPI}/billing/v1/catalog?category=DOMAIN&name=.${tld.join('.').toUpperCase()}*`, token)
      const price = catalog.flatMap((c) => c.prices).find((p) => p.period === 1 && p.period_unit === 'year')
      return { available, price: price ? { id: price.id, amount: (price.first_period_price || price.price) / 100, currency: price.currency } : null }
    },
    async buyDomain(domain, priceId) {
      await callJson('Hostinger', `${HAPI}/domains/v1/portfolio`, token, { method: 'POST', body: { domain, item_id: priceId } })
    },
  }
}

// --- Cloudflare (Mon profil > Jetons API : modèle « Modifier la zone DNS »).
const CF = 'https://api.cloudflare.com/client/v4'

export function cloudflare(token: string): DnsProvider {
  const call = <T>(path: string, init?: Parameters<typeof callJson>[3]) => callJson<{ result: T }>('Cloudflare', `${CF}${path}`, token, init).then((r) => r.result)
  return {
    id: 'cloudflare',
    async pointToServer(domain, ip) {
      const zones = await call<Array<{ id: string }>>(`/zones?name=${domain}`)
      const zoneId = zones[0]?.id
      if (!zoneId) throw new DeployError(`Le domaine ${domain} n'est pas dans ce compte Cloudflare.`)
      const upsert = async (name: string, type: 'A' | 'CNAME', content: string) => {
        const records = await call<Array<{ id: string; type: string }>>(`/zones/${zoneId}/dns_records?name=${name}`)
        for (const r of records.filter((r) => ['A', 'AAAA', 'CNAME'].includes(r.type))) {
          await call(`/zones/${zoneId}/dns_records/${r.id}`, { method: 'DELETE' })
        }
        // proxied: false : Coolify obtient lui-même le certificat HTTPS (Let's Encrypt).
        await call(`/zones/${zoneId}/dns_records`, { method: 'POST', body: { type, name, content, ttl: 300, proxied: false } })
      }
      await upsert(domain, 'A', ip)
      await upsert(`www.${domain}`, 'CNAME', domain)
      await upsert(`api.${domain}`, 'A', ip)
    },
  }
}
