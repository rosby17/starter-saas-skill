// Tâches programmées posées dans Coolify (partagées par /admin/deploy et par scripts/deployer.ts).
const call = (path: string) => `wget -q -O /dev/null --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000${path}`

export const CRON_TASKS = [
  { name: 'Taux de change', command: call('/api/cron/update-rates'), frequency: '0 3 * * *' },
  { name: 'Expiration des crédits', command: call('/api/cron/expire-credits'), frequency: '30 3 * * *' },
  { name: 'Rattrapage Maketou', command: call('/api/cron/reverify-maketou-orders'), frequency: '*/15 * * * *' },
]
