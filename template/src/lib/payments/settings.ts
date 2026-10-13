import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ACTIVE_PROVIDER, isKnownProvider, type PaymentCategoryId } from './providers'

const SETTINGS_KEY = 'payment_providers'

// active : passerelle choisie ; enabled : le type de paiement est-il proposé aux clients ? (false = coupé par l'admin,
// même si ses clés sont posées). Absent = proposé (anciens réglages).
export type PaymentProviderSettings = Record<PaymentCategoryId, { active: string; enabled: boolean }>

function defaults(): PaymentProviderSettings {
  return {
    mobile_money: { active: DEFAULT_ACTIVE_PROVIDER.mobile_money, enabled: true },
    wave: { active: DEFAULT_ACTIVE_PROVIDER.wave, enabled: true },
    card: { active: DEFAULT_ACTIVE_PROVIDER.card, enabled: true },
    paypal: { active: DEFAULT_ACTIVE_PROVIDER.paypal, enabled: true },
    crypto: { active: DEFAULT_ACTIVE_PROVIDER.crypto, enabled: true },
  }
}

export async function getPaymentProviderSettings(admin: SupabaseClient): Promise<PaymentProviderSettings> {
  const { data } = await admin.from('system_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
  const stored = (data?.value || {}) as Partial<Record<PaymentCategoryId, { active?: string; enabled?: boolean }>>
  const result = defaults()
  ;(Object.keys(result) as PaymentCategoryId[]).forEach((category) => {
    const candidate = stored[category]?.active
    if (candidate && isKnownProvider(category, candidate)) result[category].active = candidate
    if (stored[category]?.enabled === false) result[category].enabled = false
  })
  return result
}

async function saveSettings(admin: SupabaseClient, next: PaymentProviderSettings) {
  const { error } = await admin
    .from('system_settings')
    .upsert({ key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function setActivePaymentProvider(
  admin: SupabaseClient,
  category: PaymentCategoryId,
  providerId: string
): Promise<PaymentProviderSettings> {
  if (!isKnownProvider(category, providerId)) throw new Error('Moyen de paiement inconnu pour cette catégorie.')
  const current = await getPaymentProviderSettings(admin)
  const next: PaymentProviderSettings = { ...current, [category]: { ...current[category], active: providerId } }
  await saveSettings(admin, next)
  return next
}

/** Propose ou retire un type de paiement aux clients (la passerelle choisie est conservée pour la réactivation). */
export async function setPaymentCategoryEnabled(admin: SupabaseClient, category: PaymentCategoryId, enabled: boolean): Promise<PaymentProviderSettings> {
  const current = await getPaymentProviderSettings(admin)
  const next: PaymentProviderSettings = { ...current, [category]: { ...current[category], enabled } }
  await saveSettings(admin, next)
  return next
}

/** Le type de paiement est-il proposé aux clients ? En cas d'erreur de lecture : oui (ne pas casser le checkout). */
export async function isPaymentCategoryEnabled(admin: SupabaseClient, category: PaymentCategoryId): Promise<boolean> {
  try {
    return (await getPaymentProviderSettings(admin))[category].enabled
  } catch {
    return true
  }
}

/** Passerelle active d'une catégorie. Si la lecture du réglage échoue, on retombe sur la valeur par défaut connue
 *  plutôt que de casser tout le checkout. */
export async function getActivePaymentProvider(admin: SupabaseClient, category: PaymentCategoryId): Promise<string> {
  try {
    return (await getPaymentProviderSettings(admin))[category].active
  } catch (error) {
    console.error(`Lecture du moyen de paiement "${category}" impossible, valeur par défaut utilisée:`, error)
    return DEFAULT_ACTIVE_PROVIDER[category]
  }
}
