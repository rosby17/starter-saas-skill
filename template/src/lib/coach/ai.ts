import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { askClaude as askKie, kieConfigured } from '@/lib/ai/kie'

// Appel du coach business : Claude par l'API Anthropic d'abord (ANTHROPIC_API_KEY), puis un modèle Claude
// de secours, puis kie.ai (KIE_API_KEY) si tout le reste échoue. Chaque échec est rendu avec sa raison,
// pour le journal d'erreurs. Clés et modèles réglables dans Administration › Clés et intégrations.
//
// Appel EN FLUX avec un délai long : le point du jour se rédige en une à plusieurs minutes. Sans flux,
// la limite de temps d'une requête coupait Claude en pleine rédaction (appris sur un vrai SaaS, 23/10/2026),
// et les relances automatiques renvoyaient trois fois la même demande payante.

const DEFAULT_MODEL = 'claude-sonnet-5-5'
const DEFAULT_FALLBACK_MODEL = 'claude-opus-5-5'
const TIMEOUT_MS = 10 * 60_000

/** Modèle lu à chaque appel : un changement dans /admin/keys prend effet sans redéployer. */
export const coachModel = () => process.env.COACH_MODEL?.trim() || DEFAULT_MODEL
const fallbackModel = () => (process.env.COACH_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL).trim()

export const coachConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || kieConfigured())

async function askAnthropic(model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 1 })
  const message = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    output_config: { effort: 'medium' },
    system,
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage()
  if (message.stop_reason === 'refusal') throw new Error('Claude a décliné la demande')
  // Réponse coupée à la limite de longueur : le JSON serait incomplet, le modèle suivant prend la main.
  if (message.stop_reason === 'max_tokens') throw new Error('réponse coupée (limite de longueur atteinte)')
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('').trim()
}

function reason(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'clé API refusée'
  if (error instanceof Anthropic.RateLimitError) return 'limite de débit atteinte, réessayer plus tard'
  if (error instanceof Anthropic.APIError) return `erreur ${error.status ?? 'réseau'} : ${error.message.slice(0, 160)}`
  return error instanceof Error ? error.message.slice(0, 200) : 'erreur inconnue'
}

/** Texte de la réponse du coach et le moteur qui l'a donnée, ou les raisons de chaque échec. */
export async function askCoachModel(system: string, prompt: string, { maxTokens = 32_000 }: { maxTokens?: number } = {}): Promise<{ text: string; engine: string | null; failures: string[] }> {
  const failures: string[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    const models = [...new Set([coachModel(), fallbackModel()].filter(Boolean))]
    for (const model of models) {
      try {
        const text = await askAnthropic(model, system, prompt, maxTokens)
        if (text) return { text, engine: `Claude (${model})`, failures }
        failures.push(`Claude ${model} : réponse vide`)
      } catch (error) {
        failures.push(`Claude ${model} : ${reason(error)}`)
      }
    }
  }
  if (kieConfigured()) {
    try {
      const text = await askKie(prompt, { system, maxTokens: Math.min(maxTokens, 16_000), timeoutMs: 180_000 })
      if (text) return { text, engine: 'kie.ai (secours)', failures }
      failures.push('kie.ai : réponse vide')
    } catch (error) {
      failures.push(`kie.ai : ${reason(error)}`)
    }
  }
  return { text: '', engine: null, failures }
}

/** Premier objet JSON de la réponse (avec ou sans bloc ```json). */
export function parseJsonObject(text: string): unknown {
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text
    return JSON.parse(fenced.match(/\{[\s\S]*\}/)?.[0] || fenced)
  } catch {
    return null
  }
}
