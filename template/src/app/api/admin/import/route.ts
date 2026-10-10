import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { findOrCreateCustomer } from '@/lib/customers'
import { productTitlesWithIncludes, sendAccessEmail } from '@/lib/orders/deliver'

export const maxDuration = 300

const schema = z.object({
  csv: z.string().max(500_000),
  defaultProductId: z.string().uuid().optional().nullable(),
  notify: z.boolean().default(true),
  dryRun: z.boolean().default(false),
})

type Line = { line: number; name: string; email: string; phone: string; product: string }

/** Découpe un CSV simple (séparateur « , » ou « ; », guillemets gérés). */
function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell.trim()); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some((v) => v)) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell.trim())
  if (row.some((v) => v)) rows.push(row)
  return rows
}

/**
 * Import des anciens acheteurs (export Maketou, liste WhatsApp…) : colonnes nom, e-mail, téléphone, produit
 * (identifiant ou titre ; vide = produit par défaut choisi). Pour chaque ligne : compte trouvé ou créé, accès donné,
 * e-mail « Ton accès est prêt » si demandé. « dryRun » : vérifie le fichier sans rien écrire.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Fichier trop gros ou invalide (500 Ko maximum).' }, { status: 400 })
  const db = serviceClient()
  const { data: products } = await db.from('products').select('id, slug, title')
  const findProduct = (value: string) => {
    const v = value.trim().toLowerCase()
    if (!v) return parsed.data.defaultProductId ? products?.find((p) => p.id === parsed.data.defaultProductId) : undefined
    return products?.find((p) => p.slug === v || p.title.toLowerCase() === v) ?? products?.find((p) => p.title.toLowerCase().includes(v))
  }

  const rows = parseCsv(parsed.data.csv.replace(/^﻿/, ''))
  if (!rows.length) return NextResponse.json({ success: false, message: 'Aucune ligne trouvée.' }, { status: 400 })

  // En-tête facultatif : on repère les colonnes par leur nom, sinon ordre nom, e-mail, téléphone, produit.
  const head = rows[0].map((h) => h.toLowerCase())
  const hasHeader = head.some((h) => /mail/.test(h))
  const col = (re: RegExp, fallback: number) => {
    const i = head.findIndex((h) => re.test(h))
    return hasHeader && i >= 0 ? i : hasHeader ? -1 : fallback
  }
  const iName = col(/nom|name|client/, 0)
  const iEmail = col(/mail/, 1)
  const iPhone = col(/t[ée]l|phone|whatsapp|num/, 2)
  const iProduct = col(/produit|product|offre|formation/, 3)
  const lines: Line[] = (hasHeader ? rows.slice(1) : rows).slice(0, 2000).map((r, k) => ({
    line: k + (hasHeader ? 2 : 1),
    name: iName >= 0 ? r[iName] ?? '' : '',
    email: (iEmail >= 0 ? r[iEmail] ?? '' : '').toLowerCase(),
    phone: (iPhone >= 0 ? r[iPhone] ?? '' : '').replace(/[^\d+]/g, ''),
    product: iProduct >= 0 ? r[iProduct] ?? '' : '',
  }))

  const report: Array<{ line: number; email: string; result: string; ok: boolean }> = []
  let created = 0
  let granted = 0
  for (const l of lines) {
    if (!/^\S+@\S+\.\S+$/.test(l.email)) { report.push({ line: l.line, email: l.email, result: 'E-mail invalide', ok: false }); continue }
    const product = findProduct(l.product)
    if (!product) { report.push({ line: l.line, email: l.email, result: `Produit introuvable : « ${l.product || '(vide)'} »`, ok: false }); continue }
    if (parsed.data.dryRun) { report.push({ line: l.line, email: l.email, result: `OK → ${product.title}`, ok: true }); continue }
    try {
      const customer = await findOrCreateCustomer(db, { fullName: l.name || l.email.split('@')[0], email: l.email, phone: l.phone, country: '' })
      if (customer.created) created++
      const { error } = await db.rpc('grant_product_access', { p_user_id: customer.userId, p_product_id: product.id, p_source: 'import', p_order_id: null, p_granted_by: auth.userId })
      if (error) throw new Error(error.message)
      granted++
      const emailed = parsed.data.notify ? await sendAccessEmail(db, customer.userId, await productTitlesWithIncludes(db, product.id)) : false
      report.push({ line: l.line, email: l.email, result: `${customer.created ? 'Compte créé' : 'Compte existant'} · accès « ${product.title} »${emailed ? ' · e-mail envoyé' : ''}`, ok: true })
    } catch (error) {
      report.push({ line: l.line, email: l.email, result: `Erreur : ${(error as Error).message}`, ok: false })
    }
  }
  if (!parsed.data.dryRun) await logAdminAction(db, auth.userId, 'customers.import', { type: 'import', id: new Date().toISOString() }, { lines: lines.length, created, granted })
  return NextResponse.json({ success: true, dryRun: parsed.data.dryRun, total: lines.length, created, granted, report })
}
