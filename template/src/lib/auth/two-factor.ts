// Validation en deux étapes, côté serveur (Node) : codes par e-mail, codes de secours, choix de la méthode.
// Tables : migration 20261006120100_two_factor.sql (serveur uniquement, sauf lecture de sa propre méthode).
// Le contrôle « session validée ? » est dans two-factor-gate.ts (utilisable aussi dans le middleware).

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/auth/service-client'
import { sendEmailDetailed } from '@/lib/email/brevo'
import { TWO_FACTOR_SUBJECT, twoFactorCodeTemplate } from '@/lib/email/templates'
import type { TwoFactorMethod } from '@/lib/auth/two-factor-gate'

export const EMAIL_CODE_MINUTES = 10
export const EMAIL_CODES_PER_HOUR = 6
const MAX_ATTEMPTS_PER_CODE = 5
const BACKUP_CODES = 10
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sans 0/O, 1/I/L : se recopie sans erreur

function hash(value: string): string {
  const pepper = process.env.TWO_FACTOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHmac('sha256', pepper).update(value).digest('hex')
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Adresse masquée pour l'écran : r•••@gmail.com */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 1)}•••@${domain}` : '•••'
}

export type Outcome = { ok: true; message?: string } | { ok: false; message: string; status?: number }

/** Envoie un code à 6 chiffres. Attend la réponse de Brevo et rend la vraie raison d'un échec. */
export async function sendEmailCode(user: User, purpose: 'login' | 'enable'): Promise<Outcome> {
  if (!user.email) return { ok: false, message: 'Ce compte n’a pas d’adresse e-mail.' }
  const db = serviceClient()
  const since = new Date(Date.now() - 60 * 60_000).toISOString()
  const { data: recent, error: countError } = await db.from('two_factor_email_codes')
    .select('created_at').eq('user_id', user.id).gte('created_at', since).order('created_at', { ascending: true })
  if (countError) return { ok: false, status: 500, message: 'Envoi impossible (migration two_factor appliquée ?).' }
  if ((recent?.length ?? 0) >= EMAIL_CODES_PER_HOUR) {
    const wait = Math.max(1, Math.ceil((new Date(recent![0].created_at).getTime() + 60 * 60_000 - Date.now()) / 60_000))
    return { ok: false, status: 429, message: `Trop de codes demandés : réessaie dans ${wait} minute${wait > 1 ? 's' : ''}.` }
  }

  // Un seul code valable à la fois : les anciens ne servent plus.
  await db.from('two_factor_email_codes').update({ used_at: new Date().toISOString() }).eq('user_id', user.id).is('used_at', null)

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const { error } = await db.from('two_factor_email_codes').insert({
    user_id: user.id,
    code_hash: hash(`${user.id}:${code}`),
    purpose,
    expires_at: new Date(Date.now() + EMAIL_CODE_MINUTES * 60_000).toISOString(),
  })
  if (error) return { ok: false, status: 500, message: 'Le code n’a pas pu être préparé. Réessaie.' }

  const sent = await sendEmailDetailed({
    to: { email: user.email },
    subject: TWO_FACTOR_SUBJECT, // jamais le code dans le sujet : les sujets sont journalisés
    html: twoFactorCodeTemplate({ code, purpose }),
    priority: 'critical',
    template: 'two-factor-code',
  })
  if (!sent.ok) return { ok: false, status: 502, message: `Le code n’a pas pu être envoyé : ${sent.message}` }
  return { ok: true, message: `Code envoyé à ${maskEmail(user.email)}. Il est valable ${EMAIL_CODE_MINUTES} minutes.` }
}

/** Vérifie le dernier code envoyé (10 minutes, usage unique, 5 essais). */
export async function verifyEmailCode(userId: string, code: string, purpose: 'login' | 'enable'): Promise<Outcome> {
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return { ok: false, message: 'Le code fait 6 chiffres.' }
  const db = serviceClient()
  const { data: row } = await db.from('two_factor_email_codes')
    .select('id, code_hash, attempts, expires_at').eq('user_id', userId).eq('purpose', purpose).is('used_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!row) return { ok: false, message: 'Aucun code en cours : demande un nouveau code.' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, message: 'Ce code a expiré : demande un nouveau code.' }
  if (row.attempts >= MAX_ATTEMPTS_PER_CODE) return { ok: false, message: 'Trop d’essais avec ce code : demande un nouveau code.' }

  if (!sameHash(row.code_hash, hash(`${userId}:${clean}`))) {
    await db.from('two_factor_email_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    const left = MAX_ATTEMPTS_PER_CODE - row.attempts - 1
    return { ok: false, message: left > 0 ? `Code incorrect. Encore ${left} essai${left > 1 ? 's' : ''}.` : 'Code incorrect. Demande un nouveau code.' }
  }
  // Usage unique, même si deux demandes arrivent en même temps : seule la première « consomme » le code.
  const { data: used } = await db.from('two_factor_email_codes').update({ used_at: new Date().toISOString() })
    .eq('id', row.id).is('used_at', null).select('id')
  if (!used?.length) return { ok: false, message: 'Ce code a déjà servi : demande un nouveau code.' }
  return { ok: true }
}

/** Nouveaux codes de secours (les anciens ne marchent plus). Rendus UNE fois, stockés hachés. */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[randomInt(0, BACKUP_ALPHABET.length)]).join('')
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
  const db = serviceClient()
  const { error: delError } = await db.from('two_factor_backup_codes').delete().eq('user_id', userId)
  if (delError) throw delError
  const { error } = await db.from('two_factor_backup_codes').insert(codes.map((c) => ({ user_id: userId, code_hash: hash(`${userId}:${c.replace('-', '')}`) })))
  if (error) throw error
  return codes
}

/** Consomme un code de secours (usage unique). */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length !== 8) return false
  const { data } = await serviceClient().from('two_factor_backup_codes').update({ used_at: new Date().toISOString() })
    .eq('user_id', userId).eq('code_hash', hash(`${userId}:${clean}`)).is('used_at', null).select('id')
  return !!data?.length
}

export async function backupCodesLeft(userId: string): Promise<number> {
  const { count } = await serviceClient().from('two_factor_backup_codes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('used_at', null)
  return count ?? 0
}

/** Retire les applications d'authentification (facteurs TOTP) du compte. */
export async function removeTotpFactors(userId: string): Promise<void> {
  const admin = serviceClient().auth.admin.mfa
  const { data, error } = await admin.listFactors({ userId })
  if (error) throw error
  for (const factor of data?.factors ?? []) {
    if (factor.factor_type !== 'totp') continue
    const { error: delError } = await admin.deleteFactor({ id: factor.id, userId })
    if (delError) throw delError
  }
}

/** Enregistre la méthode (ou null pour désactiver) dans la table ET dans app_metadata (lu par le middleware). */
export async function setTwoFactorMethod(userId: string, method: TwoFactorMethod | null): Promise<void> {
  const db = serviceClient()
  if (method) {
    const { error } = await db.from('two_factor_settings').upsert({ user_id: userId, method, updated_at: new Date().toISOString() })
    if (error) throw error
  } else {
    const { error } = await db.from('two_factor_settings').delete().eq('user_id', userId)
    if (error) throw error
    const { error: codesError } = await db.from('two_factor_backup_codes').delete().eq('user_id', userId)
    if (codesError) throw codesError
  }
  const { data } = await db.auth.admin.getUserById(userId)
  const { error } = await db.auth.admin.updateUserById(userId, { app_metadata: { ...(data?.user?.app_metadata ?? {}), two_factor: method } })
  if (error) throw error
}
