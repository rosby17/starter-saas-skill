import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { site } from '@/config/site'

export const dynamic = 'force-dynamic'

type Row = { id: string; email: string | null; full_name: string | null; phone: string | null; country: string | null; created_at: string }

const csvCell = (v: unknown, isPhone = false) => {
  let s = String(v ?? '')
  // Évite l'exécution de formules à l'ouverture dans Excel / Sheets (un numéro, déjà réduit à « + » et chiffres, n'est pas concerné).
  if (!isPhone && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const vcfText = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/**
 * Export des clients : GET /api/admin/customers/export?format=csv|vcf[&product=<slug>]
 *  - csv : à ouvrir dans Excel / Google Sheets ;
 *  - vcf : fiches contact à importer dans le téléphone, pour retrouver les clients sur WhatsApp.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'vcf' ? 'vcf' : 'csv'
  const productSlug = searchParams.get('product') || ''
  const db = serviceClient()

  let userFilter: Set<string> | null = null
  let productTitle = ''
  if (/^[a-z0-9-]{1,80}$/.test(productSlug)) {
    const { data: product } = await db.from('products').select('id, title').eq('slug', productSlug).maybeSingle()
    if (product) {
      productTitle = product.title
      const { data: ents } = await db.from('entitlements').select('user_id').eq('product_id', product.id).is('revoked_at', null)
      userFilter = new Set((ents ?? []).map((e) => e.user_id))
    }
  }

  const rows: Row[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await db.from('profiles').select('id, email, full_name, phone, country, created_at').order('created_at').range(from, from + 999)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  const list = userFilter ? rows.filter((r) => userFilter!.has(r.id)) : rows

  const { data: ents } = await db.from('entitlements').select('user_id, product:products(title)').is('revoked_at', null)
  const purchases = new Map<string, string[]>()
  for (const e of ents ?? []) {
    const title = (e.product as unknown as { title: string } | null)?.title
    if (title) purchases.set(e.user_id, [...(purchases.get(e.user_id) ?? []), title])
  }

  await logAdminAction(db, auth.userId, 'customers.export', { type: 'export', id: format }, { count: list.length, product: productSlug || null })
  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'vcf') {
    const body = list
      .filter((r) => r.phone || r.email)
      .map((r) => {
        const name = r.full_name || r.email || 'Client'
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${vcfText(`${name} (RM)`)}`,
          `N:${vcfText(name)};;;;`,
          r.phone ? `TEL;TYPE=CELL:${r.phone.replace(/[^\d+]/g, '')}` : '',
          r.email ? `EMAIL:${vcfText(r.email)}` : '',
          `NOTE:${vcfText([`Client ${site.name}`, ...(purchases.get(r.id) ?? (productTitle ? [productTitle] : []))].join(' · '))}`,
          'END:VCARD',
        ].filter(Boolean).join('\r\n')
      })
      .join('\r\n')
    return new Response(body, { headers: { 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': `attachment; filename="clients-${stamp}.vcf"`, 'Cache-Control': 'no-store' } })
  }

  const header = ['Nom', 'E-mail', 'WhatsApp', 'Pays', 'Client depuis', 'Achats']
  const csv = [header, ...list.map((r) => [r.full_name, r.email, r.phone, r.country, r.created_at.slice(0, 10), (purchases.get(r.id) ?? []).join(' | ')])]
    .map((cols) => cols.map((c, i) => csvCell(c, i === 2 && /^\+?\d+$/.test(String(c ?? '')))).join(','))
    .join('\r\n')
  return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="clients-${stamp}.csv"`, 'Cache-Control': 'no-store' } })
}
