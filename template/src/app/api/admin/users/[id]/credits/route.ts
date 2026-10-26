import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { getCreditsBalance } from '@/lib/credits/balance'
import { sendEmail } from '@/lib/email/brevo'
import { creditsAdjustedTemplate } from '@/lib/email/templates'
import { publicOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Ajustement manuel de crédits : POST { amount: entier non nul (négatif = retrait), reason: texte obligatoire, notify? }.
// Écrit une ligne dans le registre (source 'admin_adjustment', motif dans credits.note : le CLIENT LE VOIT) et dans
// le journal d'audit. Le client est prévenu : notification dans son espace, fenêtre « Tu as reçu des crédits » à sa
// prochaine visite (api/credits/notices) et, si notify (par défaut pour un ajout), un e-mail.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const amount = Number(body.amount)
  const reason = String(body.reason || '').trim().slice(0, 300)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
    return NextResponse.json({ success: false, message: 'Montant invalide (entier non nul).' }, { status: 400 })
  }
  if (!reason) return NextResponse.json({ success: false, message: 'Une raison est obligatoire.' }, { status: 400 })
  const notify = typeof body.notify === 'boolean' ? body.notify : amount > 0

  const db = serviceClient()
  const { data: user } = await db.auth.admin.getUserById(id)
  if (!user?.user) return NextResponse.json({ success: false, message: 'Utilisateur introuvable.' }, { status: 404 })

  const { error } = await db.from('credits').insert({ user_id: id, amount, source: 'admin_adjustment', note: reason })
  if (error) return NextResponse.json({ success: false, message: "Ajustement impossible." }, { status: 500 })
  await logAdminAction(db, auth.userId, 'credits.adjust', { type: 'user', id }, { amount, reason, notify })

  // Prévenir le client ne doit jamais faire échouer l'ajustement (déjà enregistré).
  const fmt = new Intl.NumberFormat('fr-FR').format(Math.abs(amount))
  const { error: notifError } = await db.from('notifications').insert({
    user_id: id, url: '/credits',
    title: amount > 0 ? `🎁 ${fmt} crédits ajoutés à ton compte` : `${fmt} crédits retirés de ton compte`,
    body: `Motif : ${reason}`.slice(0, 1000),
  })
  if (notifError) console.error('Notification de crédits non écrite :', notifError.message)
  let emailed = false
  if (notify && user.user.email) {
    const [balance, { data: profile }] = await Promise.all([
      getCreditsBalance(db, id).catch(() => null),
      db.from('profiles').select('first_name').eq('id', id).maybeSingle(),
    ])
    emailed = await sendEmail({
      to: { email: user.user.email, name: profile?.first_name || undefined },
      subject: amount > 0 ? '🎁 Des crédits ont été ajoutés à ton compte' : 'Mise à jour de tes crédits',
      html: creditsAdjustedTemplate({ name: profile?.first_name, amount, note: reason, balance, url: `${publicOrigin()}/credits` }),
      priority: 'normal',
    })
  }
  return NextResponse.json({ success: true, message: `Crédits ajustés. Le client est prévenu${emailed ? ' (notification et e-mail)' : ' (notification)'}.` })
}
