// Démarrage du serveur : charge les clés saisies dans /admin/keys avant de servir la première requête,
// puis les relit toutes les minutes (utile si le SaaS tourne sur plusieurs instances).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSecretsSync } = await import('./instrumentation-node')
    await startSecretsSync()
  }
}
