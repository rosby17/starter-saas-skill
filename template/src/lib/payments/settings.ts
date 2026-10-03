import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ACTIVE_PROVIDER, isKnownProvider, type PaymentCategoryId } from './providers'

const SETTINGS_KEY = 'payment_providers'

export type PaymentProviderSettings = Record<PaymentCategoryId, { active: string }>

function defaults(): PaymentProviderSettings {
  return {
    mobile_money: { active: DEFAULT_ACTIVE_PROVIDER.mobile_money },
    card: { active: DEFAULT_ACTIVE_PROVIDER.card },
    paypal: { active: DEFAULT_ACTIVE_PROVIDER.paypal },
    crypto: { active: DEFAULT_ACTIVE_PROVIDER.crypto },
  }
}

export async function getPaymentProviderSettings(admin: SupabaseClient): Promise<PaymentProviderSettings> {
  const { data } = await admin.from('system_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
  const stored = (data?.value || {}) as Partial<Record<PaymentCategoryId, { active?: string }>>
  const result = defaults()
  ;(Object.keys(result) as PaymentCategoryId[]).forEach((category) => {
    const candidate = stored[category]?.active
    if (candidate && isKnownProvider(category, candidate)) result[category] = { active: candidate }
  })
  return result
}

export async function setActivePaymentProvider(
  admin: SupabaseClient,
  category: PaymentCategoryId,
  providerId: string
): Promise<PaymentProviderSettings> {
  if (!isKnownProvider(category, providerId)) throw new Error('Moyen de paiement inconnu pour cette catégorie.')
  const current = await getPaymentProviderSettings(admin)
  const next: PaymentProviderSettings = { ...current, [category]: { active: providerId } }
  const { error } = await admin
    .from('system_settings')
    .upsert({ key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
  return next
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
