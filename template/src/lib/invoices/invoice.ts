import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { site } from '@/config/site'
import { formatOrderAmount } from '@/lib/pricing/zones'
import { publicOrigin } from '@/lib/site-url'

// FACTURE d'une commande payée : mêmes données pour la page imprimable, le PDF téléchargeable et la pièce jointe
// de l'e-mail de confirmation. Les montants sont ceux de la commande (devise de la zone du client), jamais recalculés.

export type Invoice = {
  number: string
  issuedAt: Date
  paidAt: Date
  kind: 'full' | 'deposit' | 'balance'
  customer: { name: string; email: string; phone: string; country: string }
  lines: { label: string; detail: string; amount: string }[]
  total: string
  payment: { method: string; reference: string; note: string; paidAmountFcfa: string | null }
}

const KIND_LABEL = { full: 'Achat', deposit: 'Réservation (10 % du prix)', balance: 'Solde après réservation (60 % du prix)' } as const

export const invoiceNumber = (createdAt: string | Date, id: string) => `FAC-${new Date(createdAt).getFullYear()}-${id.slice(0, 8).toUpperCase()}`

/** Données de facture d'une commande « success » (null sinon). Lecture avec le client service (appelant déjà autorisé). */
export async function loadInvoice(db: SupabaseClient, orderId: string): Promise<Invoice | null> {
  const { data: o } = await db.from('orders')
    .select('id, user_id, product_id, created_at, paid_at, plan_name, amount_local, amount_fcfa, paid_amount_fcfa, currency, payment_method, payment_ref, payment_note, status, purchase_kind, customer_name, customer_email, customer_phone, customer_country')
    .eq('id', orderId).maybeSingle()
  if (!o || o.status !== 'success') return null

  const [{ data: buyer }, { data: product }] = await Promise.all([
    db.auth.admin.getUserById(o.user_id),
    o.product_id ? db.from('products').select('title, includes, category').eq('id', o.product_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  let included: string[] = []
  const inc = (product?.includes as string[] | null) ?? []
  if (inc.length) {
    const { data } = await db.from('products').select('title').in('slug', inc)
    included = (data ?? []).map((p) => p.title as string)
  }

  const kind = (o.purchase_kind as Invoice['kind']) || 'full'
  const total = formatOrderAmount(o.amount_local, o.currency)
  const detail = [KIND_LABEL[kind], included.length ? `Comprend : ${included.join(', ')}` : '', kind === 'deposit' ? 'Accès au contenu à la sortie, après paiement du solde.' : 'Accès à vie depuis ton espace client.']
    .filter(Boolean).join(' · ')
  return {
    number: invoiceNumber(o.created_at, o.id),
    issuedAt: new Date(o.created_at),
    paidAt: new Date(o.paid_at || o.created_at),
    kind,
    customer: { name: o.customer_name || '', email: o.customer_email || buyer?.user?.email || '', phone: o.customer_phone || '', country: o.customer_country || '' },
    lines: [{ label: (product?.title as string) || o.plan_name || 'Achat', detail, amount: total }],
    total,
    payment: {
      method: o.payment_method || '—',
      reference: o.payment_ref || '',
      note: o.payment_note || '',
      paidAmountFcfa: o.currency && !['XOF', 'XAF'].includes(o.currency) && o.amount_fcfa ? `soit ${formatOrderAmount(o.paid_amount_fcfa ?? o.amount_fcfa, 'XOF')}` : null,
    },
  }
}

const date = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
// Les polices n'ont pas toutes les espaces fines d'Intl : on les remplace par des espaces simples.
const clean = (s: string) => s.replace(/[  ]/g, ' ')

const INK = rgb(0.05, 0.05, 0.05)
const MUTED = rgb(0.43, 0.43, 0.45)
const LINE = rgb(0.88, 0.88, 0.9)
const BRAND = rgb(0.784, 0.063, 0.18) // #C8102E

/** PDF A4 de la facture, aux couleurs du site (police Neue Montréal, rouge de la charte). */
export async function invoicePdf(inv: Invoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Facture ${inv.number}`)
  pdf.setAuthor(site.person || site.name)
  pdf.setCreator(site.name)
  const dir = path.join(process.cwd(), 'public')
  const [reg, med, bold, logo] = await Promise.all([
    readFile(path.join(dir, 'fonts/Inter-Regular.ttf')),
    readFile(path.join(dir, 'fonts/Inter-Medium.ttf')),
    readFile(path.join(dir, 'fonts/Inter-Bold.ttf')),
    // Logo de la facture : public/invoice-logo.png ou .jpg (facultatif ; le PDF n'accepte pas le SVG).
    readFile(path.join(dir, 'invoice-logo.png')).catch(() => readFile(path.join(dir, 'invoice-logo.jpg'))).catch(() => null),
  ])
  const F = { r: await pdf.embedFont(reg), m: await pdf.embedFont(med), b: await pdf.embedFont(bold) }
  const page = pdf.addPage([595.28, 841.89])
  const W = page.getWidth(), M = 48
  let y = 841.89 - M

  const text = (p: PDFPage, s: string, x: number, yy: number, f: PDFFont, size: number, color = INK, alignRight = false) => {
    const t = clean(s)
    p.drawText(t, { x: alignRight ? x - f.widthOfTextAtSize(t, size) : x, y: yy, font: f, size, color })
  }
  const wrap = (s: string, f: PDFFont, size: number, maxW: number) => {
    const out: string[] = []; let line = ''
    for (const w of clean(s).split(' ')) {
      const t = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w } else line = t
    }
    if (line) out.push(line)
    return out
  }

  // En-tête : logo + nom de la plateforme, et bloc « FACTURE ».
  page.drawRectangle({ x: 0, y: 841.89 - 6, width: W, height: 6, color: BRAND })
  if (logo) {
    // PNG ou JPEG : on regarde la signature du fichier.
    const img = logo[0] === 0x89 ? await pdf.embedPng(logo) : await pdf.embedJpg(logo)
    page.drawImage(img, { x: M, y: y - 40, width: 40, height: 40 })
  }
  text(page, site.name, M + 52, y - 16, F.b, 15)
  text(page, site.tagline, M + 52, y - 33, F.r, 9.5, MUTED)
  text(page, 'FACTURE', W - M, y - 16, F.b, 20, BRAND, true)
  text(page, inv.number, W - M, y - 33, F.m, 10, INK, true)
  y -= 78

  // Dates et statut.
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE })
  y -= 22
  const meta: [string, string][] = [['Date de la facture', date(inv.issuedAt)], ['Date du paiement', date(inv.paidAt)], ['Statut', 'Payée']]
  meta.forEach(([k, v], i) => {
    const x = M + i * ((W - 2 * M) / 3)
    text(page, k.toUpperCase(), x, y, F.m, 7.5, MUTED)
    text(page, v, x, y - 15, i === 2 ? F.b : F.m, 11, i === 2 ? BRAND : INK)
  })
  y -= 46

  // Vendeur / client.
  const col = (W - 2 * M) / 2
  const phone = site.whatsapp
  const seller = [site.company.legalName, `${site.name}`, ...site.company.address.split('\n'), site.supportEmail, phone, publicOrigin().replace(/^https?:\/\//, '')]
  if (site.company.taxId) seller.push(`N° fiscal : ${site.company.taxId}`)
  const buyer = [inv.customer.name, inv.customer.email, inv.customer.phone, inv.customer.country].filter(Boolean)
  text(page, 'VENDEUR', M, y, F.m, 7.5, MUTED)
  text(page, 'CLIENT', M + col, y, F.m, 7.5, MUTED)
  const rows = Math.max(seller.length, buyer.length)
  for (let i = 0; i < rows; i++) {
    if (seller[i]) text(page, seller[i], M, y - 17 - i * 14, i === 0 ? F.b : F.r, i === 0 ? 11 : 9.5, i === 0 ? INK : MUTED)
    if (buyer[i]) text(page, buyer[i], M + col, y - 17 - i * 14, i === 0 ? F.b : F.r, i === 0 ? 11 : 9.5, i === 0 ? INK : MUTED)
  }
  y -= 40 + rows * 14

  // Tableau des achats.
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 26, color: rgb(0.965, 0.965, 0.97) })
  text(page, 'DESCRIPTION', M + 12, y, F.m, 8, MUTED)
  text(page, 'MONTANT', W - M - 12, y, F.m, 8, MUTED, true)
  y -= 34
  for (const l of inv.lines) {
    text(page, l.label, M + 12, y, F.b, 11.5)
    text(page, l.amount, W - M - 12, y, F.m, 11.5, INK, true)
    const det = wrap(l.detail, F.r, 9, W - 2 * M - 160)
    det.forEach((d, i) => text(page, d, M + 12, y - 16 - i * 12, F.r, 9, MUTED))
    y -= 28 + det.length * 12
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.6, color: LINE })
  }
  y -= 8
  text(page, 'Total payé', W - M - 24 - F.b.widthOfTextAtSize(clean(inv.total), 15), y, F.m, 11, MUTED, true)
  text(page, inv.total, W - M - 12, y, F.b, 15, INK, true)
  if (inv.payment.paidAmountFcfa) { y -= 15; text(page, inv.payment.paidAmountFcfa, W - M - 12, y, F.r, 9, MUTED, true) }
  y -= 44

  // Paiement.
  text(page, 'PAIEMENT', M, y, F.m, 7.5, MUTED)
  y -= 17
  const pay: [string, string][] = [['Moyen de paiement', inv.payment.method]]
  if (inv.payment.reference) pay.push(['Référence', inv.payment.reference])
  if (inv.payment.note) pay.push(['Détail', inv.payment.note])
  for (const [k, v] of pay) {
    text(page, k, M, y, F.r, 9.5, MUTED)
    const vs = wrap(v, F.m, 9.5, W - 2 * M - 140)
    vs.forEach((s, i) => text(page, s, M + 130, y - i * 13, F.m, 9.5))
    y -= 8 + vs.length * 13
  }
  if (inv.kind === 'deposit') {
    y -= 12
    wrap('Cette facture concerne la réservation de ta place. Le contenu s’ouvre à la sortie de la formation, après paiement du solde (60 % du prix au lieu de 100 %). Tu seras prévenu par e-mail.', F.r, 9.5, W - 2 * M)
      .forEach((s, i) => text(page, s, M, y - i * 13, F.r, 9.5, BRAND))
  }

  // Pied de page.
  const foot = `Merci pour ta confiance. Une question sur cette facture : ${site.supportEmail} · WhatsApp ${phone}`
  text(page, foot, W / 2 + F.r.widthOfTextAtSize(clean(foot), 8.5) / 2, M - 6, F.r, 8.5, MUTED, true)
  text(page, `${site.name} · ${site.company.address.replace(/\n/g, ', ')}`, W / 2 + F.r.widthOfTextAtSize(clean(`${site.name} · ${site.company.address.replace(/\n/g, ', ')}`), 8.5) / 2, M - 20, F.r, 8.5, MUTED, true)
  return pdf.save()
}
