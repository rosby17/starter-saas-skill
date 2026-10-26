import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { chargeSchema, feeRateSchema, providerRateSchema } from '@/lib/finance/schemas'
import { methodKey, methodLabel } from '@/lib/finance/charges'

export const dynamic = 'force-dynamic'

// Réglages des charges : GET = charges fixes et ponctuelles, tarifs datés des fournisseurs, frais datés des moyens de
// paiement (+ moyens et fournisseurs vus dans les données, pour les proposer). POST { type, data } = une ligne de plus.
// Un tarif ne se modifie pas : on ajoute une version datée (l'historique de la marge reste juste).
const TABLES = { charge: 'finance_charges', provider_rate: 'provider_rates', fee_rate: 'payment_fee_rates' } as const
type Kind = keyof typeof TABLES

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const db = serviceClient()
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString()
  const [charges, providerRates, feeRates, methods, usage] = await Promise.all([
    db.from('finance_charges').select('id, label, family, amount, currency, period, share_pct, free, starts_on, ends_on, note').order('family').order('label'),
    db.from('provider_rates').select('id, provider, service, label, amount, currency, per_units, unit, valid_from, note').order('provider').order('service').order('valid_from', { ascending: false }),
    db.from('payment_fee_rates').select('id, method, percent, valid_from').order('method').order('valid_from', { ascending: false }),
    db.from('orders').select('payment_method').eq('status', 'success').eq('is_test', false).gte('created_at', since).not('payment_method', 'is', null).limit(5000),
    db.from('provider_usage').select('provider, service').gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString()).limit(5000),
  ])
  const failed = [charges, providerRates, feeRates].find((r) => r.error)
  if (failed) return NextResponse.json({ success: false, message: 'Lecture des charges impossible (migration 20261026100000 appliquée ?).' }, { status: 500 })
  const seenMethods = new Map<string, string>()
  for (const o of methods.data ?? []) seenMethods.set(methodKey(o.payment_method), methodLabel(o.payment_method))
  const seenProviders = new Map<string, { provider: string; service: string }>()
  for (const u of usage.data ?? []) seenProviders.set(`${u.provider}|${u.service}`, { provider: u.provider, service: u.service })
  return NextResponse.json({
    success: true,
    charges: charges.data, providerRates: providerRates.data, feeRates: feeRates.data,
    methods: [...seenMethods.values()].sort(), providers: [...seenProviders.values()],
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const body = await request.json().catch(() => ({}))
  const type = body.type as Kind
  if (!(type in TABLES)) return NextResponse.json({ success: false, message: 'Type inconnu.' }, { status: 400 })
  const schema = type === 'charge' ? chargeSchema : type === 'provider_rate' ? providerRateSchema : feeRateSchema
  const parsed = schema.safeParse(body.data ?? {})
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Champs invalides.' }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db.from(TABLES[type]).insert({ ...parsed.data, created_by: auth.userId }).select('id').single()
  if (error) {
    const duplicate = error.code === '23505'
    return NextResponse.json({ success: false, message: duplicate ? 'Un tarif existe déjà à cette date : choisissez un autre jour.' : 'Enregistrement impossible.' }, { status: duplicate ? 409 : 500 })
  }
  await logAdminAction(db, auth.userId, `finance.${type}.create`, { type: TABLES[type], id: data.id }, parsed.data as Record<string, unknown>)
  return NextResponse.json({ success: true, id: data.id })
}
