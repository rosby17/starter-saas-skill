import { TZ_IANA, TZ_ISO, TZ_OFFSET_MS } from '@/lib/time'

// Créneaux d'appel, à l'heure locale de la plateforme (site.timezone, sans heure d'été) : partagé par le navigateur et le serveur.
export const CALL_SLUG = 'appel-1h'
export const CALL_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
export const MAX_SLOTS = 3
export const CALL_STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'En attente de ma réponse', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  counter: { label: 'Nouveau créneau proposé', cls: 'border-blue-200 bg-blue-50 text-blue-800' },
  confirmed: { label: 'Confirmé', cls: 'border-green-200 bg-green-50 text-green-800' },
  done: { label: 'Terminé', cls: 'border-gray-200 bg-gray-100 text-gray-600' },
  cancelled: { label: 'Annulé', cls: 'border-red-200 bg-red-50 text-red-800' },
}

/** « 2026-10-14 » + « 15:00 » (heure locale) → instant ISO. */
export const slotIso = (date: string, hour: string) => new Date(`${date}T${hour}:00${TZ_ISO}`).toISOString()

/** Un créneau valable : à l'heure pile d'une des heures proposées, au moins 12 h à l'avance, au plus 60 jours. */
export function validSlot(iso: string): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  if (t < now + 12 * 3600_000 || t > now + 60 * 86_400_000) return false
  const local = new Date(t + TZ_OFFSET_MS)
  const hh = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`
  return CALL_HOURS.includes(hh)
}

/** Affichage d'un créneau en heure locale : « mercredi 14 octobre, 15 h ». */
export function slotLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { timeZone: TZ_IANA, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':00', ' h')
}
