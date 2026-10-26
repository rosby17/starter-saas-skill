import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { adjustmentSchema } from '@/lib/finance/schemas'
import { reasonInfo } from '@/lib/finance/adjustments'
import { toFcfa } from '@/lib/finance/money'
import { loadFcfaPer } from '@/lib/finance/server'
import { dayStartIso } from '@/lib/finance/revenue'

export const dynamic = 'force-dynamic'

/**
 * Valeur au prix du site de n crédits : prix unitaire du plus gros pack publié qui ne dépasse pas n
 * (sinon celui du plus petit pack). 0 s'il n'y a aucun pack de crédits.
 */
async function catalogValueFcfa(db: SupabaseClient, credits: number): Promise<number> {
  const { data } = await db.from('products').select('credits, price_fcfa').eq('category', 'credits').eq('published', true).gt('credits', 0).gt('price_fcfa', 0).order('credits')
  const packs = (data ?? []) as { credits: number; price_fcfa: number }[]
  if (!packs.length) return 0
  const pack = [...packs].reverse().find((p) => p.credits <= credits) ?? packs[0]
  return Math.round((pack.price_fcfa / pack.credits) * credits)
}

// Mouvement d'argent hors passerelle, avec son motif : POST { reason, email?, customer_label?, credits?, apply_credits?,
// paid_amount, paid_currency, list_price_fcfa?, payment_method?, note?, occurred_on? }.
// apply_credits = verse (entrée) ou reprend (retrait) les crédits sur le compte du client, dans le même geste.
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = adjustmentSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Champs invalides.' }, { status: 400 })
  const a = parsed.data
  const info = reasonInfo(a.reason)!
  const db = serviceClient()

  // Compte du client (facultatif) : retrouvé par son adresse e-mail exacte.
  let userId: string | null = null
  if (a.email) {
    const { data } = await db.rpc('admin_search_users', { search: a.email, max_results: 5 })
    userId = ((data ?? []) as { id: string; email: string }[]).find((u) => u.email?.toLowerCase() === a.email)?.id ?? null
    if (!userId) return NextResponse.json({ success: false, message: 'Aucun compte avec cette adresse e-mail.' }, { status: 404 })
  }
  if (a.apply_credits && (!userId || !a.credits)) return NextResponse.json({ success: false, message: 'Pour verser ou reprendre des crédits, indiquez le compte et le nombre de crédits.' }, { status: 400 })
  // Don, correction, reprises : rien d'encaissé ni de rendu.
  if (info.money === 'none') a.paid_amount = 0

  const fcfaPer = await loadFcfaPer(db)
  const paidFcfa = Math.round(toFcfa(a.paid_amount, a.paid_currency, fcfaPer))
  const listPrice = a.list_price_fcfa != null ? Math.round(a.list_price_fcfa) : a.credits ? await catalogValueFcfa(db, a.credits) : 0
  const occurredAt = a.occurred_on ? new Date(Date.parse(dayStartIso(a.occurred_on)) + 12 * 3_600_000).toISOString() : new Date().toISOString()

  const { data: row, error } = await db.from('money_adjustments').insert({
    reason: a.reason, user_id: userId, customer_label: a.customer_label, credits: a.credits,
    paid_amount: a.paid_amount, paid_currency: a.paid_currency, paid_fcfa: paidFcfa, list_price_fcfa: listPrice,
    payment_method: a.payment_method, note: a.note, occurred_at: occurredAt, created_by: auth.userId,
  }).select('id').single()
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })

  if (a.apply_credits && userId && a.credits) {
    const amount = info.direction === 'retrait' ? -a.credits : a.credits
    const { error: creditError } = await db.from('credits').insert({ user_id: userId, amount, source: 'admin_adjustment' })
    if (creditError) {
      await db.from('money_adjustments').delete().eq('id', row.id)
      return NextResponse.json({ success: false, message: 'Crédits non versés : rien n’a été enregistré.' }, { status: 500 })
    }
  }
  await logAdminAction(db, auth.userId, 'finance.adjustment.create', { type: 'money_adjustments', id: row.id }, { ...a, user_id: userId, paid_fcfa: paidFcfa, list_price_fcfa: listPrice })
  return NextResponse.json({ success: true, id: row.id, paidFcfa, listPriceFcfa: listPrice })
}
