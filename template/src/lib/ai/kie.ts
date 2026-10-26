import 'server-only'

import { accountsFromEnv, EngineCallError, isNeverSentNetworkError, runWithAccountRelay, type EngineAccount } from '@/lib/engines/accounts'
import { clearEngine, engineSetAside } from '@/lib/engines/health'

// Appel texte à Claude via kie.ai (API « messages » d'Anthropic, relayée par kie.ai). PREMIER MOTEUR du socle
// multi-fournisseurs (src/lib/engines/, nom de code « Alpha 1 » dans codenames.ts) :
//  - plusieurs comptes possibles : KIE_API_KEY (principal) et KIE_API_KEY_2 (relais), collées dans
//    Administration › Clés et intégrations. Un compte qui refuse (solde, clé, saturation) passe la main à l'autre ;
//  - un moteur dont tous les comptes refusent est mis de côté quelques minutes : les appels suivants échouent tout de
//    suite (EngineUnavailableError) au lieu d'attendre un refus certain ;
//  - un délai dépassé n'est JAMAIS rejoué (la demande a peut-être été reçue : double facturation).
const MODEL = 'claude-opus-5-5'
const API = 'https://api.kie.ai/claude/v1/messages'
const ENGINE = 'kie'

export const kieAccounts = (): EngineAccount[] => accountsFromEnv(['KIE_API_KEY', 'KIE_API_KEY_2'])
export const kieConfigured = () => kieAccounts().length > 0

type KiePayload = { content?: { type?: string; text?: string }[]; code?: unknown; msg?: unknown; message?: unknown; error?: { message?: unknown } }

async function callKie(account: EngineAccount, body: Record<string, unknown>, timeoutMs: number): Promise<string> {
  let response: Response
  try {
    // Appel direct (sans SDK) : kie.ai ne renvoie pas toujours un en-tête JSON.
    response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', Authorization: `Bearer ${account.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (isNeverSentNetworkError(error)) throw new EngineCallError('connexion impossible', null, true)
    throw error // délai dépassé ou coupure en cours de route : ambigu, jamais rejoué
  }
  const raw = await response.text()
  let payload: KiePayload | null = null
  try { payload = JSON.parse(raw) } catch {}
  const text = (payload?.content ?? []).map((b) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('').trim()
  if (response.ok && text) return text
  // kie.ai peut répondre 200 avec un code d'erreur dans le corps (ex. { code: 402, msg: "…" }).
  const bodyCode = typeof payload?.code === 'number' && payload.code >= 400 ? payload.code : null
  const status = response.ok ? bodyCode ?? 502 : response.status
  const detail = [payload?.msg, payload?.message, payload?.error?.message].find((v) => typeof v === 'string') as string | undefined
  throw new EngineCallError(`Réponse IA vide ou invalide (HTTP ${status})${detail ? ` : ${detail.slice(0, 200)}` : ''}`, status)
}

/** Envoie une consigne et renvoie le texte de la réponse. Lève une erreur si aucun compte n'est réglé ou si la réponse est vide. */
export async function askClaude(instruction: string, { system, maxTokens = 2000, timeoutMs = 25_000 }: { system?: string; maxTokens?: number; timeoutMs?: number } = {}): Promise<string> {
  const accounts = kieAccounts()
  if (!accounts.length) throw new Error('KIE_API_KEY manquante')
  const body = { model: MODEL, max_tokens: maxTokens, output_config: { effort: 'low' }, ...(system ? { system } : {}), messages: [{ role: 'user', content: instruction }] }
  const text = await runWithAccountRelay(ENGINE, accounts, (account) => callKie(account, body, timeoutMs))
  // Un succès après une mise de côté : le moteur est de nouveau sain.
  if (engineSetAside(ENGINE)) clearEngine(ENGINE)
  return text
}

/** Sonde du moteur (provider-watchdog.ts) : une demande de quelques jetons sur UN compte précis, sans relais. */
export async function kieProbe(account: EngineAccount): Promise<{ done?: boolean; hasResult?: boolean; rejected?: boolean; failed?: boolean; message?: string }> {
  try {
    const text = await callKie(account, { model: MODEL, max_tokens: 8, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Réponds seulement : OK' }] }, 60_000)
    return { done: true, hasResult: Boolean(text) }
  } catch (error) {
    const status = error instanceof EngineCallError ? error.status : null
    const message = error instanceof Error ? error.message : String(error)
    // 4xx hors saturation : la demande est refusée (clé, solde, paramètre) : ne dit rien d'un blocage du service.
    if (status !== null && status >= 400 && status < 500 && status !== 429) return { rejected: true, message }
    return { failed: true, message }
  }
}

/** Extrait le premier objet JSON d'une réponse (le modèle peut l'entourer de ```json). */
export function firstJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}
