// Tâches programmées posées dans Coolify (partagées par /admin/deploy et par scripts/deployer.ts).
const call = (path: string) => `wget -q -O /dev/null --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000${path}`

export const CRON_TASKS = [
  { name: 'Taux de change', command: call('/api/cron/update-rates'), frequency: '0 3 * * *' },
  // Relit les passerelles pour livrer les paiements arrivés sans webhook, puis annule les commandes en attente depuis plus de 30 min.
  { name: 'Paiements : rattrapage et annulation après 30 min', command: call('/api/cron/reconcile-orders'), frequency: '*/5 * * * *' },
  { name: 'Expiration des crédits', command: call('/api/cron/expire-credits'), frequency: '30 3 * * *' },
  { name: 'Rappels de renouvellement des abonnements', command: call('/api/cron/subscription-reminders'), frequency: '0 8 * * *' },
]
