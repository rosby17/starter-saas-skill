// Démarrage du serveur : charge les clés saisies dans /admin/keys avant de servir la première requête,
// puis les relit toutes les minutes (utile si le SaaS tourne sur plusieurs instances).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSecretsSync } = await import('./instrumentation-node')
    await startSecretsSync()
  }
}

// Toute erreur serveur vue par un client (page, route, action) : une ligne repérable dans les journaux de Coolify
// (chercher « [ERREUR CLIENT] »). Pour être prévenu, brancher GlitchTip ou Sentry ici.
export function onRequestError(error: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  const err = error as { message?: string; digest?: string; stack?: string }
  console.error(`[ERREUR CLIENT] ${request.method} ${request.path} (${context.routeType ?? '?'} ${context.routePath ?? ''}) : ${err?.message ?? String(error)}${err?.digest ? ` [digest ${err.digest}]` : ''}`)
  if (err?.stack) console.error(err.stack)
}
