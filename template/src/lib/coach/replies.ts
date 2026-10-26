import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { askCoachModel, parseJsonObject } from './ai'
import { coachPersona } from './persona'
import { clientMessageStyle, type CoachSettings } from './settings'

// Réponses des clients contactés : l'admin colle la réponse, le coach l'analyse tout de suite (motif, suite
// à donner, date de relance). Le client n'est plus proposé avant cette date, et le point du jour suivant
// tient compte de toutes les réponses récentes : c'est la meilleure information dont le coach dispose.

const KEY = 'coach_replies'
const MAX_PER_CLIENT = 10
const DAY = 86_400_000

export const REPLY_REASONS = ['prix', 'budget_temporaire', 'pas_le_temps', 'projet_en_pause', 'qualite', 'probleme_technique', 'paiement', 'concurrent', 'besoin_fini', 'satisfait_va_racheter', 'autre'] as const

export const replyAnalysisSchema = z.object({
  reason: z.string().min(1).max(300),
  category: z.enum(REPLY_REASONS).catch('autre'),
  intent: z.enum(['forte', 'moyenne', 'faible']).catch('moyenne'),
  nextAction: z.string().min(1).max(400),
  /** AAAA-MM-JJ avant laquelle on ne relance pas ; null = rien à attendre. */
  recontactAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  message: z.string().max(1200).nullish(),
  lesson: z.string().max(300).nullish(),
})
export type ReplyAnalysis = z.infer<typeof replyAnalysisSchema>

export type ClientReply = { at: string; text: string; action: string | null; analysis: ReplyAnalysis | null; engine: string | null }
export type RepliesStore = Record<string, ClientReply[]>

export async function readReplies(db: SupabaseClient): Promise<RepliesStore> {
  const { data } = await db.from('system_settings').select('value').eq('key', KEY).maybeSingle()
  const value = data?.value as RepliesStore | undefined
  return value && typeof value === 'object' ? value : {}
}

async function writeReplies(db: SupabaseClient, value: RepliesStore) {
  const { error } = await db.from('system_settings').upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`enregistrement impossible : ${error.message}`)
}

/** Retire e-mails et numéros avant d'envoyer un texte au modèle. */
export const scrubContactDetails = (text: string) => text
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
  .replace(/\+?\d[\d\s.-]{7,}\d/g, '[numéro]')

/** Clients à ne pas relancer aujourd'hui (date de relance pas encore passée). */
export const snoozedClientIds = (store: RepliesStore, today: string) =>
  Object.entries(store).filter(([, list]) => { const until = list[0]?.analysis?.recontactAfter; return Boolean(until && until > today) }).map(([id]) => id)

/** Réponses récentes, sans identité, pour le point du jour. */
export function recentRepliesForModel(store: RepliesStore, days = 30) {
  const since = new Date(Date.now() - days * DAY).toISOString()
  return Object.values(store).flatMap((list) => list.filter((r) => r.at >= since)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25).map((r) => ({
    date: r.at.slice(0, 10),
    contacteDans: r.action,
    reponse: scrubContactDetails(r.text).slice(0, 600),
    motif: r.analysis?.category ?? null,
    intention: r.analysis?.intent ?? null,
    relanceApres: r.analysis?.recontactAfter ?? null,
  }))
}

async function clientContext(db: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: orders }] = await Promise.all([
    db.from('profiles').select('created_at, country').eq('id', userId).maybeSingle(),
    db.from('orders').select('created_at, plan_name').eq('user_id', userId).eq('status', 'success').eq('is_test', false).order('created_at', { ascending: false }).limit(20),
  ])
  return {
    achats: orders?.length ?? 0,
    dernierAchat: orders?.[0]?.created_at?.slice(0, 10) ?? null,
    dernierProduit: orders?.[0]?.plan_name ?? null,
    inscritLe: profile?.created_at?.slice(0, 10) ?? null,
    pays: profile?.country ?? null,
  }
}

async function analyzeReply(db: SupabaseClient, settings: CoachSettings, userId: string, text: string, action: string | null, history: ClientReply[]) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `L'administrateur a contacté un client${action ? ` (tâche du jour : « ${action} »)` : ''} et colle sa réponse. Analyse-la et dis exactement quoi faire ensuite, en expert de la monétisation : relance au bon moment, offre adaptée, aide, ou rien si le client n'est pas une cible.

Aujourd'hui : ${today}.
Le client : ${JSON.stringify(await clientContext(db, userId))}
Réponses précédentes de ce client : ${JSON.stringify(history.slice(0, 3).map((r) => ({ date: r.at.slice(0, 10), reponse: scrubContactDetails(r.text).slice(0, 400), suite: r.analysis?.nextAction ?? null })))}
Sa réponse (ou ce que l'administrateur en résume) : « ${scrubContactDetails(text).slice(0, 2000)} »

${clientMessageStyle(settings)}

Réponds uniquement avec un JSON valide, sans Markdown :
{"reason":"le motif en une phrase","category":"${REPLY_REASONS.join('|')}","intent":"forte|moyenne|faible","nextAction":"ce que l'administrateur fait maintenant, en une ou deux phrases","recontactAfter":"AAAA-MM-JJ ou null (date réaliste d'après la réponse)","message":"message court à envoyer au client si utile, avec {prenom}, sinon null","lesson":"ce que cette réponse apprend pour l'offre ou le produit, sinon null"}`
  const { text: raw, engine } = await askCoachModel(coachPersona(settings), prompt, { maxTokens: 4000 })
  const parsed = replyAnalysisSchema.safeParse(raw ? parseJsonObject(raw) : null)
  return { analysis: parsed.success ? parsed.data : null, engine }
}

/** Enregistre la réponse puis la fait analyser ; la réponse est gardée même si l'analyse échoue. */
export async function saveClientReply(db: SupabaseClient, settings: CoachSettings, userId: string, text: string, action: string | null, analyze: boolean): Promise<ClientReply> {
  const history = (await readReplies(db))[userId] ?? []
  let analysis: ReplyAnalysis | null = null
  let engine: string | null = null
  try {
    if (analyze) ({ analysis, engine } = await analyzeReply(db, settings, userId, text, action, history))
  } catch (error) {
    console.error('[coach] analyse de réponse impossible', error instanceof Error ? error.message : error)
  }
  const reply: ClientReply = { at: new Date().toISOString(), text, action, analysis, engine }
  // Relire juste avant d'écrire : l'analyse a pris plusieurs secondes.
  const latest = await readReplies(db)
  latest[userId] = [reply, ...(latest[userId] ?? [])].slice(0, MAX_PER_CLIENT)
  await writeReplies(db, latest)
  return reply
}

export async function deleteClientReply(db: SupabaseClient, userId: string, at: string) {
  const store = await readReplies(db)
  const list = (store[userId] ?? []).filter((r) => r.at !== at)
  if (list.length) store[userId] = list
  else delete store[userId]
  await writeReplies(db, store)
}
