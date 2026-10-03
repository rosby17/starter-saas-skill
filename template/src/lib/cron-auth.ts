import { timingSafeEqual } from 'crypto'

/**
 * Autorise un appel de tâche planifiée : `Authorization: Bearer $CRON_SECRET`.
 * FERMÉ par défaut : si CRON_SECRET n'est pas défini, personne n'est autorisé
 * (l'ancienne version laissait la route ouverte à tout le monde dans ce cas).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET non défini : toutes les tâches planifiées sont refusées.')
    return false
  }
  const provided = request.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
