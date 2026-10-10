import 'server-only'

// Appel texte à Claude via kie.ai (API « messages » d'Anthropic, relayée par kie.ai).
// Clé : KIE_API_KEY, collée dans Admin → Paramètres → Clés et intégrations.
const MODEL = 'claude-opus-5-5'

export const kieConfigured = () => !!process.env.KIE_API_KEY

/** Envoie une consigne et renvoie le texte de la réponse. Lève une erreur si la clé manque ou si la réponse est vide. */
export async function askClaude(instruction: string, { system, maxTokens = 2000, timeoutMs = 25_000 }: { system?: string; maxTokens?: number; timeoutMs?: number } = {}): Promise<string> {
  const apiKey = process.env.KIE_API_KEY
  if (!apiKey) throw new Error('KIE_API_KEY manquante')
  // Appel direct (sans SDK) : kie.ai ne renvoie pas toujours un en-tête JSON.
  const response = await fetch('https://api.kie.ai/claude/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, output_config: { effort: 'low' }, ...(system ? { system } : {}), messages: [{ role: 'user', content: instruction }] }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const raw = await response.text()
  let payload: { content?: { type?: string; text?: string }[] } | null = null
  try { payload = JSON.parse(raw) } catch {}
  const text = (payload?.content ?? []).map((b) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('').trim()
  if (!response.ok || !text) throw new Error(`Réponse IA vide ou invalide : ${raw.slice(0, 200) || response.status}`)
  return text
}

/** Extrait le premier objet JSON d'une réponse (le modèle peut l'entourer de ```json). */
export function firstJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}
