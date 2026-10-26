import { z } from 'zod'
import { ADJUSTMENT_REASONS } from './adjustments'

// Validation des écritures du pilotage financier (routes /api/admin/finance/*).

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).')
const optionalDay = z.union([day, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null))
const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null))
const currency = z.enum(['XAF', 'EUR', 'USD'])
// « 1 234,5 » comme « 1234.5 ».
const amount = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v.replace(/[\s  ]/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue({ code: 'custom', message: 'Montant invalide (nombre positif).' }); return z.NEVER }
  return n
})

export const chargeSchema = z.object({
  label: z.string().trim().min(1, 'Donnez un nom à la charge.').max(120),
  family: z.enum(['fixe', 'ponctuelle']),
  amount,
  currency,
  period: z.enum(['monthly', 'yearly', 'once']),
  share_pct: amount.refine((n) => n <= 100, 'La part imputée va de 0 à 100 %.').default(100),
  free: z.boolean().default(false),
  starts_on: optionalDay,
  ends_on: optionalDay,
  note: text(500),
}).superRefine((c, ctx) => {
  if (c.family === 'ponctuelle' && (c.period !== 'once' || !c.starts_on)) ctx.addIssue({ code: 'custom', message: 'Une dépense ponctuelle a une date.' })
  if (c.family === 'fixe' && c.period === 'once') ctx.addIssue({ code: 'custom', message: 'Un abonnement est mensuel ou annuel.' })
  if (c.starts_on && c.ends_on && c.ends_on < c.starts_on) ctx.addIssue({ code: 'custom', message: 'La fin est avant le début.' })
})

export const providerRateSchema = z.object({
  provider: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{1,40}$/, 'Identifiant du fournisseur : minuscules, chiffres, - _ . (tel que noté dans provider_usage).'),
  service: z.string().trim().max(60).default(''),
  label: text(80),
  amount,
  currency,
  per_units: amount.refine((n) => n > 0, 'Le nombre d’unités doit être positif.'),
  unit: z.string().trim().min(1).max(30),
  valid_from: day,
  note: text(300),
})

export const feeRateSchema = z.object({
  method: z.string().trim().min(1).max(60),
  percent: amount.refine((n) => n <= 100, 'Un pourcentage va de 0 à 100.'),
  valid_from: day,
})

export const adjustmentSchema = z.object({
  reason: z.enum(ADJUSTMENT_REASONS.map((r) => r.value) as [string, ...string[]]),
  email: z.string().trim().toLowerCase().max(200).optional().nullable().transform((v) => (v ? v : null)),
  customer_label: text(120),
  credits: z.union([z.number(), z.string(), z.null()]).optional().transform((v, ctx) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(String(v).replace(/[\s  ]/g, ''))
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) { ctx.addIssue({ code: 'custom', message: 'Crédits : nombre entier positif.' }); return z.NEVER }
    return n
  }),
  /** Ajouter (entrée) ou retirer (retrait) les crédits sur le compte du client. */
  apply_credits: z.boolean().default(false),
  paid_amount: amount.default(0),
  paid_currency: currency.default('XAF'),
  list_price_fcfa: amount.optional().nullable(),
  payment_method: text(60),
  note: text(500),
  occurred_on: optionalDay,
})
