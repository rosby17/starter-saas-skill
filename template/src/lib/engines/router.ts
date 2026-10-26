import 'server-only'

import { getEngine, getModel, SERVICES, type EngineDefinition, type ModelDefinition } from './catalog'
import { accountSetAside, engineSetAside } from './health'
import { readEngineSettings, type EngineSettings } from './settings'

// CHOIX DU MOTEUR d'un modèle, pour UNE demande :
//  1. le moteur actif choisi par l'admin (ou le premier du modèle), s'il est en état de servir ;
//  2. sinon, SEULEMENT si la bascule automatique est activée, le premier autre moteur du modèle en état de servir ;
//  3. sinon aucun : le modèle est grisé côté client (jamais une demande envoyée vers un moteur à sec).

export type EngineState = 'ready' | 'missing_keys' | 'set_aside'

/** Un moteur peut-il servir maintenant ? (clés posées, au moins un compte non mis de côté, moteur non mis de côté) */
export function engineState(engine: EngineDefinition, now = Date.now()): EngineState {
  const accounts = engine.accounts()
  if (!accounts.length) return 'missing_keys'
  if (engineSetAside(engine.id, now)) return 'set_aside'
  if (accounts.every((account) => accountSetAside(engine.id, account.id, now))) return 'set_aside'
  return 'ready'
}

export const activeEngineId = (model: ModelDefinition, settings: EngineSettings) => {
  const chosen = settings.active[model.id]
  return chosen && model.engines.includes(chosen as never) ? chosen : model.engines[0]
}

export function pickEngineFor(model: ModelDefinition, settings: EngineSettings, now = Date.now()): { engine: EngineDefinition; fallback: boolean } | null {
  const activeId = activeEngineId(model, settings)
  const active = getEngine(activeId)
  if (active && engineState(active, now) === 'ready') return { engine: active, fallback: false }
  if (!settings.autoFallback) return null
  for (const id of model.engines) {
    if (id === activeId) continue
    const engine = getEngine(id)
    if (engine && engineState(engine, now) === 'ready') return { engine, fallback: true }
  }
  return null
}

/** Moteur qui doit servir ce modèle maintenant, ou null (modèle indisponible). */
export async function resolveEngine(modelId: string) {
  const found = getModel(modelId)
  if (!found) return null
  return pickEngineFor(found.model, await readEngineSettings())
}

/** Modèles qui n'ont plus aucun moteur en état de servir (à griser côté client). Identifiants seulement. */
export async function unavailableModels(): Promise<string[]> {
  const settings = await readEngineSettings()
  return SERVICES.flatMap((service) => service.models.filter((model) => !pickEngineFor(model, settings)).map((model) => model.id))
}
