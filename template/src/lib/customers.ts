import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Coordonnées demandées avant chaque achat ou demande : elles sont enregistrées dans le profil du client.
export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Ton nom est obligatoire.').max(120),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v.replace(/[^\d+]/g, ''))
    .refine((v) => /^\+?\d{8,15}$/.test(v), 'Numéro WhatsApp invalide (avec l’indicatif, ex. +237 6xx xx xx xx).'),
  country: z.string().trim().max(60).optional().default(''),
})
export type Contact = z.infer<typeof contactSchema>

/**
 * Retrouve le compte correspondant à l'e-mail, ou le crée (e-mail considéré comme vérifié : le client
 * le prouvera en ouvrant le lien de connexion reçu). Complète le profil avec les coordonnées si elles manquent.
 * Renvoie created = true si le compte vient d'être créé par CET appel.
 */
export async function findOrCreateCustomer(db: SupabaseClient, contact: Contact): Promise<{ userId: string; created: boolean }> {
  const existing = await findUserIdByEmail(db, contact.email)
  if (existing) {
    await completeProfile(db, existing, contact)
    return { userId: existing, created: false }
  }

  const { data, error } = await db.auth.admin.createUser({
    email: contact.email,
    email_confirm: true,
    user_metadata: { full_name: contact.fullName, first_name: contact.fullName.split(/\s+/)[0], phone: contact.phone, country: contact.country },
  })
  if (error || !data.user) {
    // Course possible : le même e-mail vient d'être créé par une autre requête.
    const again = await findUserIdByEmail(db, contact.email)
    if (again) return { userId: again, created: false }
    throw new Error(`Compte impossible à créer : ${error?.message}`)
  }
  await completeProfile(db, data.user.id, contact)
  return { userId: data.user.id, created: true }
}

// Supabase enregistre les e-mails en minuscules : comparaison exacte (pas de « ilike », où « _ » serait un joker).
export async function findUserIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('id').eq('email', email.trim().toLowerCase()).limit(1).maybeSingle()
  return data?.id ?? null
}

/** Complète le profil sans écraser ce que le client a déjà renseigné lui-même. */
async function completeProfile(db: SupabaseClient, userId: string, contact: Contact) {
  const { data: profile } = await db.from('profiles').select('full_name, phone, country, email, first_name').eq('id', userId).maybeSingle()
  const patch: Record<string, string> = {}
  if (!profile?.full_name) patch.full_name = contact.fullName
  if (!profile?.first_name) patch.first_name = contact.fullName.split(/\s+/)[0]
  if (!profile?.phone && contact.phone) patch.phone = contact.phone
  if (!profile?.country && contact.country) patch.country = contact.country
  if (!profile?.email) patch.email = contact.email
  if (!profile) {
    await db.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' })
  } else if (Object.keys(patch).length) {
    await db.from('profiles').update(patch).eq('id', userId)
  }
}
