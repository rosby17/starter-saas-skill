// Démarrage du serveur : charge les clés saisies dans /admin/keys avant de servir la première requête,
// puis les relit toutes les minutes (utile si le SaaS tourne sur plusieurs instances).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSecretsSync } = await import('./instrumentation-node')
    await startSecretsSync()
    const { startServerResourceSampler } = await import('./lib/server-resource-history')
    startServerResourceSampler()
  }
}

// Toute erreur serveur vue par un client : une ligne dans les journaux de Coolify (« [ERREUR CLIENT] ») ET dans le journal
// /admin/sante, à côté des erreurs signalées par le navigateur. Pour être prévenu, brancher aussi GlitchTip ou Sentry ici.
export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  const err = error as { message?: string; digest?: string; stack?: string }
  console.error(`[ERREUR CLIENT] ${request.method} ${request.path} (${context.routeType ?? '?'} ${context.routePath ?? ''}) : ${err?.message ?? String(error)}${err?.digest ? ` [digest ${err.digest}]` : ''}`)
  if (err?.stack) console.error(err.stack)
  // Condition écrite « === 'nodejs' » (et pas un « return » anticipé) : Next ne retire l'import du paquet Edge que sous cette forme,
  // sinon la construction échoue (error-log utilise le module crypto de Node).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recordErrorLog } = await import('./lib/monitoring/error-log')
    await recordErrorLog({
      source: 'server',
      page: context.routePath,
      action: `${request.method} ${request.path.split('?')[0]}`,
      httpStatus: 500,
      errorMessage: err?.message ?? String(error),
      details: { route_type: context.routeType, ...(err?.stack ? { stack: err.stack.slice(0, 4000) } : {}) },
    })
  }
}
