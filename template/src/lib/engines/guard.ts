import 'server-only'

import { NextResponse } from 'next/server'
import { isServiceClosedForClient } from '@/lib/monitoring/service-outages'
import { getModel, getService } from './catalog'
import { resolveEngine } from './router'

// À appeler en tête de chaque route de l'espace client qui sert un service IA, AVANT tout débit de crédits :
//
//   const gate = await serviceGate('assistant', 'assistant-texte', { isApiKey })
//   if (gate.response) return gate.response
//   // gate.engine = moteur à utiliser pour cette demande
//
// Réponses calmes, sans jargon (aucun nom de moteur ni de fournisseur) : le client sait que rien n'a été débité.
// error_code « service_closed » / « model_unavailable » : le journal d'erreurs les classe « rien à corriger ».
// Les appels avec clé d'API ne sont jamais arrêtés par une pause de service (seulement par un modèle sans moteur).

export async function serviceGate(serviceId: string, modelId: string, { isApiKey = false }: { isApiKey?: boolean } = {}) {
  const service = getService(serviceId)
  if (await isServiceClosedForClient(serviceId, isApiKey)) {
    return {
      engine: null,
      response: NextResponse.json({
        success: false,
        error_code: 'service_closed',
        message: `« ${service?.label ?? 'Ce service'} » est en pause quelques instants, le temps que nous le rétablissions. Rien n'a été débité, et le reste du site fonctionne normalement.`,
      }, { status: 503 }),
    }
  }
  const picked = await resolveEngine(modelId)
  if (!picked) {
    const model = getModel(modelId)?.model
    return {
      engine: null,
      response: NextResponse.json({
        success: false,
        error_code: 'model_unavailable',
        message: `« ${model?.label ?? 'Ce modèle'} » est momentanément indisponible. Rien n'a été débité : choisissez un autre modèle ou réessayez dans quelques minutes.`,
      }, { status: 503 }),
    }
  }
  return { engine: picked.engine, fallback: picked.fallback, response: null }
}
