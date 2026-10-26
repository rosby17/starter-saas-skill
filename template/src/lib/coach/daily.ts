import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { localDay } from '@/lib/time'
import { askCoachModel, parseJsonObject } from './ai'
import { coachPersona } from './persona'
import { clientMessageStyle, readCoachSettings } from './settings'
import { anonymizeForModel, buildCoachSnapshot, COACH_AUDIENCES, type CoachAudience } from './snapshot'
import { readReplies, recentRepliesForModel, snoozedClientIds } from './replies'

// Point du jour du coach : une analyse par jour (heure de site.timezone), lancée à la première ouverture de
// /admin/coach et gardée dans system_settings. Pensé pour être compris en une minute : l'essentiel en 2-3
// phrases, puis une CHECKLIST d'actions prêtes à exécuter (clients à contacter avec le message, prompt de
// développement à copier, étapes), des objectifs chiffrés, le client idéal et des idées tirées du comportement.

const KEY = 'coach_daily'
/** Clients écartés à la main (« je connais sa situation ») : id → date. */
const IGNORED_KEY = 'coach_ignored'
/** Version du format : un point du jour plus ancien est régénéré. */
export const BRIEF_VERSION = 1
const HISTORY_DAYS = 14

const AUDIENCE_KEYS = Object.keys(COACH_AUDIENCES) as [CoachAudience, ...CoachAudience[]]
export const ACTION_KINDS = ['contacter', 'developper', 'configurer', 'acheter', 'surveiller'] as const

// Contrôle TOLÉRANT (appris : un champ un peu trop long faisait rejeter tout le point du jour, donc une
// analyse payée pour rien) : on coupe ou on écrête, et seule une réponse vraiment inutilisable est refusée.
const clip = (max: number) => z.string().trim().min(1).transform((v) => (v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v))
const upTo = <T extends z.ZodTypeAny>(item: T, max: number, min = 0) => z.array(item).min(min).transform((list) => list.slice(0, max))
const optionalList = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).nullish().transform((list) => (list ?? []).slice(0, max))

export const dailyBriefSchema = z.object({
  headline: clip(220),
  verdict: z.enum(['bon', 'moyen', 'critique']).catch('moyen'),
  essentials: upTo(z.string().min(1), 3, 1),
  actions: upTo(z.object({
    title: z.string().min(1),
    why: z.string().catch(''),
    impact: z.enum(['fort', 'moyen', 'faible']).catch('moyen'),
    kind: z.enum(ACTION_KINDS).catch('surveiller'),
    audience: z.enum(AUDIENCE_KEYS).nullish().catch(null),
    customers: z.array(z.string()).nullish().catch(null).transform((list) => list?.slice(0, 10) ?? null),
    message: z.object({ subject: z.string(), body: z.string() }).nullish().catch(null),
    prompt: z.string().nullish().catch(null),
    steps: z.array(z.string()).nullish().catch(null).transform((list) => list?.slice(0, 5) ?? null),
  }), 5, 1),
  watch: optionalList(z.string(), 3),
  followUp: z.string().nullish().transform((v) => v ?? ''),
  objectives: upTo(z.object({
    area: z.enum(['marketing', 'finance', 'produit', 'ventes']).catch('produit'),
    goal: clip(200),
    method: clip(400),
  }), 4).nullish().catch(null),
  idealCustomer: z.object({
    portrait: clip(600),
    whyTheyBuy: optionalList(z.string().min(1), 4),
    channels: optionalList(z.object({
      platform: z.string().min(1).max(40),
      angle: z.string().min(1),
      contentIdeas: optionalList(z.string().min(1), 5),
      cadence: z.string().catch(''),
      kpi: z.string().catch(''),
    }), 4),
    trustBuilders: optionalList(z.string().min(1), 5),
    testOffer: clip(500),
  }).nullish().catch(null),
  ideas: upTo(z.object({
    observation: z.string().min(1),
    need: z.string().min(1),
    feature: z.string().min(1),
    impact: z.enum(['fort', 'moyen', 'faible']).catch('moyen'),
    prompt: z.string().min(1),
  }), 6).nullish().catch(null),
})

export type DailyBrief = z.infer<typeof dailyBriefSchema>
export type DailyAction = DailyBrief['actions'][number]

export type StoredDaily = {
  version: number
  day: string
  generatedAt: string
  engine: string | null
  brief: DailyBrief
  revenue: { last30d: number; previous30d: number; last7d: number; goal: number; goalProgress: number; orders30d: number; payingCustomers30d: number; averageOrder: number }
  activeCustomers30d: number
  /** Vrais clients de chaque groupe et des « Client N » (jamais envoyés au modèle). */
  audienceIds: Record<CoachAudience, string[]>
  highIntentIds: string[]
  /** Actions faites (index → date), clients contactés et clients relancés par e-mail (id → date). */
  done: Record<string, string>
  contacted: Record<string, string>
  emailed: Record<string, string>
  history: Array<{ day: string; headline: string; actions: string[]; done?: string[] }>
}

export const coachDay = (now = Date.now()) => localDay(now)

async function readKey<T>(db: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as T | undefined) ?? null
}

async function writeKey(db: SupabaseClient, key: string, value: unknown) {
  const { error } = await db.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`enregistrement impossible : ${error.message}`)
}

export async function readDaily(db: SupabaseClient): Promise<StoredDaily | null> {
  const value = await readKey<StoredDaily>(db, KEY)
  return value && typeof value === 'object' && value.brief && value.version === BRIEF_VERSION ? value : null
}
export const writeDaily = (db: SupabaseClient, value: StoredDaily) => writeKey(db, KEY, value)

export async function readIgnored(db: SupabaseClient): Promise<Record<string, string>> {
  const value = await readKey<Record<string, string>>(db, IGNORED_KEY)
  return value && typeof value === 'object' ? value : {}
}
export const writeIgnored = (db: SupabaseClient, value: Record<string, string>) => writeKey(db, IGNORED_KEY, value)

function systemPrompt(persona: string, style: string): string {
  return `${persona}

Chaque matin, le fondateur lit ton point du jour en une minute et doit savoir exactement quoi faire pour atteindre l'objectif mensuel.

Règles :
- Appuie-toi uniquement sur les données fournies ; n'invente aucun chiffre ; dis-le si une donnée manque. Les montants sont en FCFA.
- Court et simple : phrases brèves, français courant, pas de jargon, pas de répétition des chiffres déjà affichés.
- Des actions exécutables tout de suite, classées de la plus rentable à la moins rentable, chacune reliée à l'objectif.
- Pour contacter des clients : choisis un groupe parmi ceux fournis ("groupes"), ou des clients précis de la liste "forteIntention" (Client 1, Client 2…), et rédige le message à envoyer (objet + texte, court, avec {prenom} pour le prénom et {lien} pour le lien vers l'offre ; pas de promesse trompeuse, pas de pression). ${style}
- Choisis le bon groupe et le bon message : un client fidèle ne reçoit pas une relance d'abandon, un client qui a encore de quoi utiliser le produit ne reçoit pas « rachetez ». {lien} n'a de sens que pour ceux qui doivent acheter.
- Pour une fonctionnalité à développer : écris un prompt complet, autonome et précis (contexte, comportement attendu, critères d'acceptation) à coller tel quel à un développeur ou à Claude Code.
- Pour une configuration ou un achat : 2 à 4 étapes concrètes.
- Suis les actions de la veille ("historiqueDuCoach" : ce qui a été fait) et ce que ça a donné.
- Réponses des clients contactés ("reponsesClients") : la meilleure information dont tu disposes. Tires-en les motifs qui reviennent, adapte actions et messages, dis-le dans "followUp".
- Objectifs ("objectives", 2 à 4) : un par levier utile aujourd'hui (marketing, finance, produit, ventes), chacun chiffré sur la semaine ou le mois, avec la méthode.
- Client idéal ("idealCustomer") : d'après les plus gros acheteurs et les produits qui se vendent, qui ils sont, pourquoi ils paient, 3 ou 4 canaux pour toucher leurs semblables (angle, idées de contenus concrets, cadence, indicateur), ce qui les fait prendre l'offre au sérieux, et une offre d'essai rentable.
- Idées ("ideas", 3 à 5), la partie la plus importante après les actions : analyse minutieusement "comportements" ; pour chaque idée, une observation chiffrée, le besoin qu'elle révèle, la fonctionnalité qui y répond et fait gagner du chiffre d'affaires ou économiser du budget, puis un prompt complet pour un développeur. Ne repropose pas une idée déjà faite.`
}

async function buildPrompt(db: SupabaseClient, previous: StoredDaily | null) {
  const settings = await readCoachSettings(db)
  const replies = await readReplies(db)
  const ignored = await readIgnored(db)
  const snapshot = await buildCoachSnapshot(db, { goal: settings.monthlyGoal, excludeIds: [...Object.keys(ignored), ...snoozedClientIds(replies, coachDay())] })
  const data = {
    objectifMensuelFcfa: settings.monthlyGoal,
    ...anonymizeForModel(snapshot),
    historiqueDuCoach: (previous?.history ?? []).slice(0, 7),
    reponsesClients: recentRepliesForModel(replies),
  }
  const prompt = `Données d'aujourd'hui (${coachDay()}) :
${JSON.stringify(data)}

Rédige le point du jour. Réponds uniquement avec un JSON valide, sans Markdown :
{"headline":"une phrase","verdict":"bon|moyen|critique","essentials":["2 ou 3 phrases courtes"],"actions":[{"title":"verbe d'action + objet","why":"une phrase chiffrée","impact":"fort|moyen|faible","kind":"contacter|developper|configurer|acheter|surveiller","audience":"${AUDIENCE_KEYS.join('|')} (contacter seulement)","customers":["Client 1"],"message":{"subject":"…","body":"… {prenom} … {lien} …"},"prompt":"(developper seulement)","steps":["étape courte"]}],"watch":["au plus 3 risques"],"followUp":"une ou deux phrases sur hier et les réponses des clients","objectives":[{"area":"marketing|finance|produit|ventes","goal":"objectif chiffré","method":"comment"}],"idealCustomer":{"portrait":"…","whyTheyBuy":["…"],"channels":[{"platform":"…","angle":"…","contentIdeas":["…"],"cadence":"…","kpi":"…"}],"trustBuilders":["…"],"testOffer":"…"},"ideas":[{"observation":"…","need":"…","feature":"…","impact":"fort|moyen|faible","prompt":"…"}]}
Entre 3 et 5 actions, 3 à 5 idées. Champs inutiles pour un type d'action : null.`
  return { prompt, snapshot, system: systemPrompt(coachPersona(settings), clientMessageStyle(settings)) }
}

let generating: Promise<StoredDaily> | null = null
export const isGeneratingDaily = () => generating !== null

/** Génère (une seule à la fois par serveur) et enregistre le point du jour. */
export function generateDaily(db: SupabaseClient): Promise<StoredDaily> {
  if (generating) return generating
  generating = (async () => {
    const previous = await readDaily(db)
    const { prompt, snapshot, system } = await buildPrompt(db, previous)
    const { text, engine, failures } = await askCoachModel(system, prompt)
    const json = text ? parseJsonObject(text) : null
    const parsed = dailyBriefSchema.safeParse(json)
    if (!parsed.success) {
      const reason = !text ? null
        : json === null ? `réponse coupée ou JSON invalide (${text.length} caractères)`
        : `format non conforme : ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'racine'} : ${i.message}`).join(' ; ')}`
      throw new Error([...failures, reason ? `Réponse illisible : ${reason}` : null].filter(Boolean).join(' | ') || 'Aucun moteur IA ne répond')
    }
    const day = coachDay()
    // Le suivi d'hier sait ce qui a été fait (cases cochées dans l'admin).
    const previousDone = previous ? Object.keys(previous.done ?? {}).map((i) => previous.brief.actions[Number(i)]?.title).filter((t): t is string => Boolean(t)) : []
    const history = [
      { day, headline: parsed.data.headline, actions: parsed.data.actions.map((a) => a.title) },
      ...(previous?.history ?? []).filter((e) => e.day !== day).map((e, i) => (i === 0 && previous?.day === e.day && previousDone.length ? { ...e, done: previousDone } : e)),
    ].slice(0, HISTORY_DAYS)
    const { revenue } = snapshot
    const stored: StoredDaily = {
      version: BRIEF_VERSION,
      day,
      generatedAt: new Date().toISOString(),
      engine,
      brief: parsed.data,
      revenue: { last30d: revenue.last30d, previous30d: revenue.previous30d, last7d: revenue.last7d, goal: revenue.goal, goalProgress: revenue.goalProgress, orders30d: revenue.orders30d, payingCustomers30d: revenue.payingCustomers30d, averageOrder: revenue.averageOrder },
      activeCustomers30d: snapshot.totals.active30d,
      audienceIds: snapshot.audiences,
      highIntentIds: snapshot.highIntent.map((c) => c.id),
      done: {},
      contacted: {},
      emailed: {},
      history,
    }
    await writeDaily(db, stored)
    return stored
  })().finally(() => { generating = null })
  return generating
}

/** Clients d'une action « contacter » : les clients précis cités, sinon tout le groupe. */
export function actionCustomerIds(daily: StoredDaily, action: DailyAction): string[] {
  const named = (action.customers ?? [])
    .map((label) => /(\d+)/.exec(label)?.[1])
    .map((n) => (n ? daily.highIntentIds[Number(n) - 1] : undefined))
    .filter((id): id is string => Boolean(id))
  if (named.length) return [...new Set(named)]
  return action.audience ? daily.audienceIds?.[action.audience] ?? [] : []
}
