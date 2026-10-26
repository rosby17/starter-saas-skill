import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { site } from '@/config/site'

// Réglages du coach (Administration › Coach › Réglages), gardés dans system_settings (clé coach_settings) :
// objectif de chiffre d'affaires, ce que vend le SaaS, client idéal, et la SIGNATURE NOMINATIVE des messages
// aux clients (nom, rôle, contacts) en français et en anglais. Les valeurs par défaut viennent de site.ts.

const KEY = 'coach_settings'

const text = (max: number) => z.string().trim().max(max)

export const coachSettingsSchema = z.object({
  /** Objectif de chiffre d'affaires mensuel, en FCFA (devise des commandes). */
  monthlyGoal: z.number().int().min(0).max(10_000_000_000),
  /** Ce que vend le SaaS, à qui, comment (contexte donné au coach). */
  business: text(1500),
  /** Client idéal : qui achète le plus, et pourquoi. Vide = le coach le déduit des données. */
  idealCustomer: text(1500),
  /** Signature nominative : une personne, son rôle, l'entreprise. */
  signerName: text(120),
  signerRoleFr: text(120),
  signerRoleEn: text(120),
  companyName: text(120),
  taglineFr: text(200),
  taglineEn: text(200),
  whatsapp: text(40),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]),
  website: z.union([z.literal(''), z.string().trim().url().max(300)]),
  addressFr: text(200),
  addressEn: text(200),
  /** Adresse qui reçoit les réponses des clients aux e-mails groupés. */
  replyTo: z.union([z.literal(''), z.string().trim().email().max(200)]),
})

export type CoachSettings = z.infer<typeof coachSettingsSchema>

export function defaultCoachSettings(): CoachSettings {
  return {
    monthlyGoal: 6_500_000,
    business: site.description,
    idealCustomer: '',
    signerName: site.person || '',
    signerRoleFr: site.person ? 'Fondateur' : '',
    signerRoleEn: site.person ? 'Founder' : '',
    companyName: site.name,
    taglineFr: site.tagline,
    taglineEn: '',
    whatsapp: site.whatsapp,
    email: site.supportEmail,
    website: site.url,
    addressFr: '',
    addressEn: '',
    replyTo: site.supportEmail,
  }
}

/** Réglages en place, complétés par les valeurs par défaut (un champ ajouté plus tard ne casse rien). */
export async function readCoachSettings(db: SupabaseClient): Promise<CoachSettings> {
  const defaults = defaultCoachSettings()
  const { data } = await db.from('system_settings').select('value').eq('key', KEY).maybeSingle()
  const merged = { ...defaults, ...((data?.value as Partial<CoachSettings> | undefined) ?? {}) }
  const parsed = coachSettingsSchema.safeParse(merged)
  return parsed.success ? parsed.data : defaults
}

export async function writeCoachSettings(db: SupabaseClient, value: CoachSettings): Promise<void> {
  const { error } = await db.from('system_settings').upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`enregistrement impossible : ${error.message}`)
}

/** Nom qui signe : la personne, sinon l'équipe. */
export const signerLine = (s: CoachSettings) => (s.signerName ? `${s.signerName}${s.signerRoleFr ? `, ${s.signerRoleFr}` : ''} de ${s.companyName}` : `L'équipe ${s.companyName}`)

/**
 * Ton des messages aux clients (règle apprise : « toujours le nous dans les prises de contact, toujours
 * rester professionnel ») : corps au « nous », vouvoiement, formule de fin nominative.
 */
export function clientMessageStyle(s: CoachSettings): string {
  return `Ton des messages destinés aux clients : on écrit toujours au nom de l'équipe ${s.companyName}, à la première personne du pluriel (« nous », « notre équipe », « nous restons à votre disposition »), jamais « je », « moi » ni « mon ». Vouvoiement, ton professionnel et courtois : formule d'appel « Bonjour {prenom}, », phrases complètes, pas de familiarité, pas d'emoji, pas de point d'exclamation en série. Formule de fin sobre et nominative : « Cordialement, ${signerLine(s)} » (le corps reste au « nous » ; dans un e-mail, la signature complète est ajoutée automatiquement, ne la réécris pas).`
}

/** Signature de l'e-mail dans la langue du message. */
export function emailSignature(s: CoachSettings, lang: 'fr' | 'en') {
  const en = lang === 'en'
  return {
    name: s.signerName,
    role: (en ? s.signerRoleEn : s.signerRoleFr) || s.signerRoleFr,
    company: s.companyName,
    tagline: (en ? s.taglineEn : s.taglineFr) || '',
    whatsapp: s.whatsapp,
    email: s.email,
    website: s.website,
    address: (en ? s.addressEn : s.addressFr) || s.addressFr,
  }
}
