import { site } from '@/config/site'

// Heure locale de la plateforme (site.timezone) : créneaux d'appel, fin des promotions, jours des statistiques.
export const TZ_OFFSET_MS = site.timezone.offsetHours * 3_600_000
const sign = site.timezone.offsetHours < 0 ? '-' : '+'
const abs = Math.abs(site.timezone.offsetHours)
/** Suffixe ISO du fuseau, ex. « +01:00 ». */
export const TZ_ISO = `${sign}${String(Math.floor(abs)).padStart(2, '0')}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`
/** Libellé affiché à côté d'une heure, ex. « heure de Douala (UTC+1) ». */
export const TZ_LABEL = site.timezone.label
/** Fuseau IANA pour l'affichage (Intl). */
export const TZ_IANA = site.timezone.iana
/** Jour local (AAAA-MM-JJ) d'un instant. */
export const localDay = (t: number | string | Date) => new Date(new Date(t).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10)
