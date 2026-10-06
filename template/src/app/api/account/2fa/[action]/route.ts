import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'
import { markSecondFactorDone, twoFactorContext } from '@/lib/auth/two-factor-session'
import { TWO_FACTOR_COOKIE, hasVerifiedTotp, tokenClaims, twoFactorMethod } from '@/lib/auth/two-factor-gate'
import {
  generateBackupCodes, removeTotpFactors, sendEmailCode, setTwoFactorMethod, consumeBackupCode, verifyEmailCode,
} from '@/lib/auth/two-factor'

export const dynamic = 'force-dynamic'

// Validation en deux étapes du compte connecté. POST /api/account/2fa/<action> :
//   send          { purpose: 'login' | 'enable' }  envoie un code par e-mail (6 par heure)
//   verify        { code, kind: 'email' | 'backup' } deuxième étape de la connexion
//   enable-email  { code }  active « Par e-mail » (rend les codes de secours, une seule fois)
//   enable-totp             active « Avec une application » après mfa.challengeAndVerify (session aal2)
//   backup-codes            nouveaux codes de secours
//   disable                 désactive (session déjà validée)
// Ces routes échappent au contrôle du middleware (il faut pouvoir valider) : chacune vérifie elle-même.

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status })

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const ctx = await twoFactorContext()
  if (!ctx) return fail('Non connecté.', 401)
  const { user, accessToken, pending } = ctx
  const body = await request.json().catch(() => ({})) as { purpose?: string; code?: string; kind?: string }
  const method = twoFactorMethod(user)

  if (!checkRateLimit(`2fa:${action}:${user.id}`, action === 'verify' ? 10 : 20, 10 * 60_000).success) {
    return fail('Trop de tentatives : patiente quelques minutes.', 429)
  }

  try {
    switch (action) {
      case 'send': {
        const purpose = body.purpose === 'enable' ? 'enable' : 'login'
        if (purpose === 'login' && pending !== 'email') return fail('Aucun code à envoyer pour cette session.')
        if (purpose === 'enable' && pending) return fail('Termine d’abord la validation de cette session.', 403)
        const sent = await sendEmailCode(user, purpose)
        return sent.ok ? NextResponse.json({ success: true, message: sent.message }) : fail(sent.message, sent.status ?? 400)
      }

      case 'verify': {
        if (!pending) return NextResponse.json({ success: true })
        const code = String(body.code || '')
        let ok = false
        let message = 'Code de secours incorrect ou déjà utilisé.'
        if (body.kind === 'backup') {
          ok = await consumeBackupCode(user.id, code)
        } else if (pending === 'email') {
          const checked = await verifyEmailCode(user.id, code, 'login')
          ok = checked.ok
          if (!checked.ok) message = checked.message
        } else {
          return fail('Saisis le code de ton application d’authentification.')
        }
        if (!ok) return fail(message)
        return markSecondFactorDone(NextResponse.json({ success: true }), user.id, accessToken)
      }

      case 'enable-email': {
        if (pending) return fail('Termine d’abord la validation de cette session.', 403)
        const checked = await verifyEmailCode(user.id, String(body.code || ''), 'enable')
        if (!checked.ok) return fail(checked.message)
        if (hasVerifiedTotp(user)) await removeTotpFactors(user.id) // une seule méthode à la fois
        await setTwoFactorMethod(user.id, 'email')
        const backupCodes = await generateBackupCodes(user.id)
        return markSecondFactorDone(NextResponse.json({ success: true, backupCodes }), user.id, accessToken)
      }

      case 'enable-totp': {
        // L'application vient d'être reliée (mfa.enroll puis challengeAndVerify côté navigateur) : la session est aal2.
        if (!hasVerifiedTotp(user) || tokenClaims(accessToken).aal !== 'aal2') {
          return fail('Le code de l’application n’a pas encore été validé. Recommence l’étape du QR code.')
        }
        await setTwoFactorMethod(user.id, 'totp')
        const backupCodes = await generateBackupCodes(user.id)
        return markSecondFactorDone(NextResponse.json({ success: true, backupCodes }), user.id, accessToken)
      }

      case 'backup-codes': {
        if (pending) return fail('Termine d’abord la validation de cette session.', 403)
        if (!method) return fail('Active d’abord la validation en deux étapes.')
        return NextResponse.json({ success: true, backupCodes: await generateBackupCodes(user.id) })
      }

      case 'disable': {
        if (pending) return fail('Termine d’abord la validation de cette session.', 403)
        await removeTotpFactors(user.id)
        await setTwoFactorMethod(user.id, null)
        ;(await cookies()).delete(TWO_FACTOR_COOKIE)
        return NextResponse.json({ success: true })
      }

      default:
        return fail('Action inconnue.', 404)
    }
  } catch (error) {
    console.error(`Validation en deux étapes (${action}) impossible :`, error)
    return fail('L’opération n’a pas abouti. Réessaie dans un instant (migration two_factor appliquée ?).', 500)
  }
}
