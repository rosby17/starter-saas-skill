// NOMS DE CODE DES MOTEURS : SOURCE UNIQUE. Partout à l'écran (administration comprise), un moteur s'appelle par
// son nom de code, jamais par le nom de son fournisseur : une capture d'écran envoyée à un client, à un partenaire
// ou à un autre fournisseur ne doit pas révéler qui fait tourner le SaaS. La correspondance n'est écrite qu'ici.
//
// Ajouter un moteur : une ligne dans ENGINE_CODENAMES (lettre grecque + numéro d'ordre, jamais réutilisé) et les
// formes d'affichage du fournisseur dans PROVIDER_PATTERNS. Les identifiants internes (« kie »), les variables
// d'environnement (KIE_API_KEY) et les adresses d'API ne changent pas.
//
//   Alpha 1 = kie.ai (Claude relayé), branché dans src/lib/ai/kie.ts

export const ENGINE_CODENAMES = {
  kie: 'Alpha 1',
} as const

export type EngineId = keyof typeof ENGINE_CODENAMES

// Formes d'affichage seulement : « KIE_ » (variable) et les adresses (api.kie.ai) ne sont pas touchées.
const PROVIDER_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![\w.])(?:KIE|Kie|kie)(?:\.ai)?(?![\w-])/g, ENGINE_CODENAMES.kie],
]

/** Nom de code d'un moteur (l'identifiant brut si le moteur est inconnu). */
export const engineCodename = (id: string): string => (ENGINE_CODENAMES as Record<string, string>)[id] ?? id

/** Remplace les noms de fournisseurs d'un texte affiché par leur nom de code. */
export function maskProviders<T extends string | null | undefined>(text: T): T {
  if (!text) return text
  let masked: string = text
  for (const [pattern, replacement] of PROVIDER_PATTERNS) masked = masked.replace(pattern, replacement)
  return masked as T
}
