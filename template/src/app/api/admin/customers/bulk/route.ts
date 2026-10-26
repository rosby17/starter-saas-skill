import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { accountIdsForFilter, isValidDomain, parseAccountFilter, setDomainRule, setSuspended, type AccountRow } from '@/lib/admin/accounts'
import { findSuspensionReason } from '@/lib/admin/suspension-reasons'

export const dynamic = 'force-dynamic'

// Actions en lot sur les comptes : POST { action, ids? | filter?, domain?, reason_code?, notify? }
//   suspend / unsuspend          : suspension (motif obligatoire, e-mail préétabli) ou réactivation
//   mark_internal / unmark_internal : compte de l'équipe ou d'un testeur (jamais suspendu en lot)
//   block_domain                 : bloque le domaine (inscriptions refusées) ET suspend ses comptes
//   allow_domain                 : « site sérieux » : le domaine n'est plus jamais classé suspect
// Cible : les identifiants cochés, ou TOUT ce qui correspond au filtre courant de l'écran (plafonné).
// Garde-fous : jamais son propre compte, jamais un administrateur ni un compte interne suspendu en lot.
const MAX_TARGETS = 2000

const schema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'mark_internal', 'unmark_internal', 'block_domain', 'allow_domain']),
  ids: z.array(z.string().uuid()).max(MAX_TARGETS).optional(),
  filter: z.record(z.string(), z.string()).optional(),
  domain: z.string().trim().toLowerCase().max(253).optional(),
  reason_code: z.string().max(60).optional(),
  note: z.string().trim().max(300).optional(),
  notify: z.boolean().optional(),
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Demande invalide.' }, { status: 400 })
  const { action, ids, filter, note = '' } = parsed.data
  const reason = findSuspensionReason(parsed.data.reason_code)
  const suspends = action === 'suspend' || action === 'block_domain'
  if (suspends && !reason) return NextResponse.json({ success: false, message: 'Choisis un motif de suspension.' }, { status: 400 })

  const db = serviceClient()
  let targets: AccountRow[]
  let domain = ''
  try {
    if (action === 'block_domain' || action === 'allow_domain') {
      domain = (parsed.data.domain ?? '').replace(/^@/, '')
      if (!isValidDomain(domain)) return NextResponse.json({ success: false, message: 'Domaine invalide (exemple : domaine.com).' }, { status: 400 })
      // Domaine courant (gmail.com…) : on refuse de le bloquer, ce serait suspendre des milliers de clients honnêtes.
      if (action === 'block_domain' && COMMON_PROVIDERS.has(domain)) {
        return NextResponse.json({ success: false, message: `${domain} est un fournisseur d’adresses courant : on ne le bloque pas. Suspends les comptes un par un.` }, { status: 400 })
      }
      await setDomainRule(db, auth.userId, domain, action === 'allow_domain' ? 'allowed' : 'blocked', note || reason?.label || '')
      if (action === 'allow_domain') return NextResponse.json({ success: true, message: `${domain} est marqué « site sérieux » : ses comptes ne sont plus jamais classés suspects.`, affected: 0 })
      targets = await accountIdsForFilter(db, { q: `@${domain}`, account: 'live', activity: 'all', spent: 'all', risk: 'all' })
      targets = targets.filter((t) => t.domain === domain)
    } else if (ids?.length) {
      targets = await accountIdsForFilter(db, { q: '', account: 'all', activity: 'all', spent: 'all', risk: 'all' }, ids)
    } else if (filter) {
      targets = await accountIdsForFilter(db, parseAccountFilter(filter))
    } else {
      return NextResponse.json({ success: false, message: 'Aucun compte ciblé.' }, { status: 400 })
    }
  } catch (error) {
    console.error('Action en lot :', error)
    return NextResponse.json({ success: false, message: 'Lecture des comptes impossible.' }, { status: 500 })
  }
  if (targets.length > MAX_TARGETS) {
    return NextResponse.json({ success: false, message: `Trop de comptes ciblés (${targets.length}). Limite : ${MAX_TARGETS}. Affine le filtre.` }, { status: 400 })
  }

  let skipped = 0
  const toProcess = targets.filter((t) => {
    if (suspends && (t.id === auth.userId || t.is_admin || t.is_internal || t.suspended)) { skipped++; return false }
    if (action === 'unsuspend' && !t.suspended) { skipped++; return false }
    return true
  })

  let affected = 0
  let failed = 0
  let emailed = 0
  // Par petits paquets : l'API d'authentification et l'envoi d'e-mails n'aiment pas les rafales.
  for (let i = 0; i < toProcess.length; i += 6) {
    await Promise.all(toProcess.slice(i, i + 6).map(async (t) => {
      try {
        if (action === 'mark_internal' || action === 'unmark_internal') {
          const { error } = await db.from('profiles').update({ is_internal: action === 'mark_internal' }).eq('id', t.id)
          if (error) throw error
        } else {
          const res = await setSuspended(db, auth.userId, { id: t.id, email: t.email }, suspends, { reason, notify: parsed.data.notify, bulk: true })
          if (res.emailed) emailed++
        }
        affected++
      } catch (error) {
        console.error('Action en lot sur un compte :', action, t.id, error)
        failed++
      }
    }))
  }
  if (action === 'mark_internal' || action === 'unmark_internal') {
    await logAdminAction(db, auth.userId, `customer.${action}`, { type: 'users', id: String(affected) }, { ids: toProcess.slice(0, 50).map((t) => t.id) })
  }

  const parts = [`${affected} compte(s) traité(s)`]
  if (emailed) parts.push(`${emailed} e-mail(s) envoyé(s)`)
  if (skipped) parts.push(`${skipped} ignoré(s) (toi, administrateurs, comptes internes ou déjà dans cet état)`)
  if (failed) parts.push(`${failed} en échec`)
  return NextResponse.json({ success: failed === 0, message: `${parts.join(' · ')}.`, affected, skipped, failed, emailed })
}

const COMMON_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr',
  'live.com', 'live.fr', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'orange.fr',
  'free.fr', 'sfr.fr', 'laposte.net', 'gmx.com', 'gmx.fr', 'yandex.com', 'mail.ru', 'zoho.com',
])
