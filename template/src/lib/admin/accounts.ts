import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/brevo'
import { accountSuspendedTemplate } from '@/lib/email/templates'
import { logAdminAction } from '@/lib/auth/audit'
import type { SuspensionReason } from '@/lib/admin/suspension-reasons'
import { ACCOUNT_FILTER_VALUES, type AccountFilter } from '@/lib/admin/account-filters'

// Comptes vus par l'administration : segments (activité réelle, dépense, risque, état), recherche et actions en lot.
// Tout le filtrage se fait dans la base (fonction admin_list_accounts, migration 20261026120000) : jamais de liste
// d'identifiants envoyée dans une URL (l'API de données répond « URI too long » au-delà de quelques centaines).

/** Durée du bannissement Supabase Auth : 100 ans = « jusqu'à réactivation ». */
const BAN_DURATION = '876000h'

export type AccountRow = {
  id: string; email: string | null; full_name: string | null; phone: string | null; country: string | null
  is_admin: boolean; is_internal: boolean; created_at: string; last_sign_in_at: string | null; last_activity_at: string | null
  activity: 'active' | 'inactive' | 'dormant'; spent: boolean; suspended: boolean; suspension_reason: string | null
  suspect: boolean; domain: string; total_count: number
}

/** Lit les filtres envoyés par l'écran (valeurs inconnues = valeur par défaut). */
export function parseAccountFilter(input: URLSearchParams | Record<string, unknown>): AccountFilter {
  const get = (k: string) => (input instanceof URLSearchParams ? input.get(k) : (input[k] as string | undefined)) ?? ''
  const pick = <K extends keyof typeof ACCOUNT_FILTER_VALUES>(k: K) => {
    const allowed = ACCOUNT_FILTER_VALUES[k] as readonly string[]
    const v = get(k)
    return (allowed.includes(v) ? v : allowed[0]) as AccountFilter[K]
  }
  return {
    // Liste blanche : la recherche part dans un paramètre de fonction SQL (aucun risque d'injection), on borne la taille.
    q: get('q').trim().slice(0, 80),
    activity: pick('activity'), spent: pick('spent'), risk: pick('risk'), account: pick('account'),
  }
}

export async function listAccounts(db: SupabaseClient, filter: AccountFilter, page: number, pageSize: number) {
  const { data, error } = await db.rpc('admin_list_accounts', {
    p_q: filter.q, p_activity: filter.activity, p_spent: filter.spent, p_risk: filter.risk, p_account: filter.account,
    p_limit: pageSize, p_offset: (page - 1) * pageSize, p_ids_only: false, p_ids: null,
  })
  if (error) throw error
  const rows = (data ?? []) as AccountRow[]
  return { rows, total: Number(rows[0]?.total_count ?? 0) }
}

/** Comptes ciblés par une action en lot : TOUT le filtre (plafonné à 5 000), ou seulement les identifiants cochés. */
export async function accountIdsForFilter(db: SupabaseClient, filter: AccountFilter, ids?: string[]): Promise<AccountRow[]> {
  // Les identifiants cochés partent dans le corps de l'appel RPC (POST), jamais dans l'URL.
  const { data, error } = await db.rpc('admin_list_accounts', {
    p_q: filter.q, p_activity: filter.activity, p_spent: filter.spent, p_risk: filter.risk, p_account: filter.account,
    p_limit: 100, p_offset: 0, p_ids_only: true, p_ids: ids?.length ? ids : null,
  })
  if (error) throw error
  return (data ?? []) as AccountRow[]
}

/**
 * Suspend (ou réactive) un compte : bannissement Supabase Auth (bloque la connexion et le renouvellement de session),
 * motif sur le profil, e-mail préétabli du motif si `notify`, trace dans le journal d'audit.
 * Renvoie emailed = true si l'e-mail est parti.
 */
export async function setSuspended(
  db: SupabaseClient,
  adminId: string,
  user: { id: string; email: string | null },
  suspend: boolean,
  opts: { reason?: SuspensionReason; notify?: boolean; bulk?: boolean } = {},
): Promise<{ emailed: boolean }> {
  const { error: banError } = await db.auth.admin.updateUserById(user.id, { ban_duration: suspend ? BAN_DURATION : 'none' })
  if (banError) throw banError
  const { error } = await db.from('profiles').update(suspend
    ? { suspension_reason: opts.reason?.code ?? null, suspended_at: new Date().toISOString() }
    : { suspension_reason: null, suspended_at: null }).eq('id', user.id)
  if (error) throw error
  let emailed = false
  if (suspend && opts.notify !== false && user.email && opts.reason) {
    emailed = await sendEmail({
      to: { email: user.email },
      subject: 'Ton compte a été suspendu',
      html: accountSuspendedTemplate({ reason: opts.reason.email }),
      priority: 'high',
    })
  }
  await logAdminAction(db, adminId, suspend ? 'customer.suspend' : 'customer.unsuspend', { type: 'user', id: user.id },
    { reason_code: opts.reason?.code ?? null, reason: opts.reason?.label ?? null, emailed, bulk: !!opts.bulk })
  return { emailed }
}

export const isValidDomain = (domain: string) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)

/** Domaine « bloqué » (inscriptions refusées, comptes classés suspects) ou « autorisé » (site sérieux : jamais suspect). */
export async function setDomainRule(db: SupabaseClient, adminId: string, domain: string, kind: 'blocked' | 'allowed', reason: string) {
  // Une règle par domaine : bloquer un domaine autorisé (ou l'inverse) remplace la règle précédente.
  const { error } = await db.from('email_domain_rules').upsert(
    { domain, kind, source: 'admin', reason: reason || (kind === 'allowed' ? 'Site sérieux vérifié' : 'Bloqué depuis l’administration'), created_by: adminId },
    { onConflict: 'domain' },
  )
  if (error) throw error
  await logAdminAction(db, adminId, kind === 'allowed' ? 'domain.allow' : 'domain.block', { type: 'domain', id: domain }, { reason })
}

/** Vrai si l'adresse appartient à un domaine bloqué (liste du kit ou admin) et non autorisé à part. */
export async function isEmailDomainBlocked(db: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await db.rpc('email_domain_blocked', { p_email: email })
  // Table absente (migration pas encore passée) : on laisse passer, l'inscription ne doit pas tomber.
  if (error) { console.error('Contrôle du domaine e-mail impossible :', error.message); return false }
  return data === true
}
