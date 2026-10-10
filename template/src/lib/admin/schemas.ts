import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null))
const optionalInt = z.union([z.number(), z.string(), z.null()]).optional().transform((v, ctx) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[\s ]/g, ''))
  if (!Number.isInteger(n) || n < 0) {
    ctx.addIssue({ code: 'custom', message: 'Montant invalide (nombre entier en FCFA).' })
    return z.NEVER
  }
  return n
})
// Chemin interne (/…) ou adresse https.
const link = z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v), 'Lien invalide : /chemin ou https://…')

export const productSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Identifiant : minuscules, chiffres et tirets.').max(80),
  category: z.enum(['formation', 'abonnement', 'accompagnement', 'logiciel', 'service', 'credits']),
  title: z.string().trim().min(2).max(160),
  subtitle: optionalText(300),
  description: optionalText(6000),
  features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  price_fcfa: optionalInt,
  compare_at_fcfa: optionalInt,
  promo_price_fcfa: optionalInt,
  promo_ends_at: z.string().trim().optional().nullable().transform((v, ctx) => {
    if (!v) return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Date de fin de promo invalide.' })
      return z.NEVER
    }
    return d.toISOString()
  }),
  image: link,
  sales_url: link,
  external_url: link,
  request_kind: z.enum(['coaching', 'accompagnement', 'projet', 'design', 'audit', 'autre']).optional().nullable().transform((v) => v ?? null),
  includes: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(10).default([]),
  published: z.boolean().default(false),
  preorder: z.boolean().default(false),
  position: z.number().int().min(0).max(100000).default(0),
  billing: z.enum(['one_time', 'monthly']).default('one_time'),
  period_days: z.number().int().min(1).max(366).default(30),
  covers_all: z.boolean().default(false),
  credits: z.number().int().min(0).max(100_000_000).default(0),
  credits_validity_days: z.number().int().min(1).max(3660).nullable().optional().transform((v) => v ?? null),
  updates_for: z.string().trim().toLowerCase().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Cours mis à jour : identifiant invalide.'),
})

export const lessonSchema = z.object({
  product_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  // Module de la leçon (titre affiché au-dessus du groupe de leçons) et résumé « ce que tu vas faire ».
  section: optionalText(120),
  summary: optionalText(600),
  description: optionalText(4000),
  youtube_url: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(v), 'Lien YouTube invalide.'),
  video_path: z.string().trim().max(400).optional().nullable().transform((v) => (v ? v : null)),
  duration_seconds: z.number().int().min(0).max(86400).optional().nullable().transform((v) => v ?? null),
  is_preview: z.boolean().default(false),
  position: z.number().int().min(0).max(100000).default(0),
  // Date de sortie : avant l'achat d'un client = dans sa version (à vie) ; après = réservée aux abonnés.
  released_at: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return undefined
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Date de sortie invalide.' })
      return z.NEVER
    }
    return d.toISOString()
  }),
})

export const fileSchema = z.object({
  product_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  storage_path: z.string().trim().min(1).max(400),
  size_bytes: z.number().int().min(0).optional().nullable().transform((v) => v ?? null),
  position: z.number().int().min(0).max(100000).default(0),
})

/** Un chemin de stockage doit rester DANS le dossier du produit (pas de « .. », pas de chemin absolu). */
export const storagePathFor = (productId: string, path: string) =>
  path.startsWith(`${productId}/`) && !path.includes('..') && /^[0-9a-f-]{36}\/[\w.\-/ ]{1,300}$/i.test(path)
