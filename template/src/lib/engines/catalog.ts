import 'server-only'

import { kieAccounts, kieProbe } from '@/lib/ai/kie'
import type { EngineAccount } from './accounts'
import { ENGINE_CODENAMES, type EngineId } from './codenames'

// MOTEURS MULTI-FOURNISSEURS : une seule structure pour tout le SaaS, service → modèles → moteurs.
//  - SERVICE : ce que le client utilise (« Assistant IA », « Synthèse vocale »…), avec son nom à l'écran ;
//  - MODÈLE : ce que le client choisit et paie dans ce service (son nom ne change jamais) ;
//  - MOTEUR : le fournisseur qui sert réellement le modèle, affiché par son nom de code (codenames.ts).
// Un modèle peut être servi par plusieurs moteurs : l'admin choisit le moteur ACTIF de chaque modèle
// (Administration › Moteurs IA) ; les autres ne servent qu'en secours, et seulement si la bascule automatique est
// activée (coupée par défaut : changer de moteur change le rendu, c'est une décision de l'admin).
//
// Ajouter un moteur : son nom de code dans codenames.ts, une entrée dans ENGINES (comptes, sonde facultative),
// puis son id dans `engines` des modèles qu'il sait servir. Ajouter un service : une entrée dans SERVICES, et dans
// ses routes un appel à serviceGate() (guard.ts) AVANT tout débit de crédits.

/** Résultat d'un essai de sonde sur un compte. */
export type ProbeSubmit = { taskId?: string | null; done?: boolean; hasResult?: boolean; rejected?: boolean; failed?: boolean; message?: string }
export type ProbeRead = { status: string; hasResult: boolean }

export type EngineDefinition = {
  id: EngineId
  codename: string
  /** Comptes du moteur (une clé par compte) : le premier est le principal, les suivants servent de relais. */
  accounts: () => EngineAccount[]
  /** Ordre de grandeur du coût, affiché à l'admin seulement. */
  cost?: string
  /**
   * Sonde facultative : une demande minuscule qui doit aboutir en quelques secondes. Moteur à tâches (dépôt puis
   * suivi) : `submit` renvoie un taskId et `read` le statut. Moteur à réponse directe : `submit` renvoie `done`.
   */
  probe?: { submit: (account: EngineAccount) => Promise<ProbeSubmit>; read?: (account: EngineAccount, taskId: string) => Promise<ProbeRead | null> }
}

export type ModelDefinition = { id: string; label: string; engines: EngineId[] }

export type ServiceDefinition = {
  id: string
  /** Nom du service à l'écran du client (bandeau de pause, message). */
  label: string
  models: ModelDefinition[]
  /** La sonde surveille-t-elle ce service (si son moteur actif a une sonde) ? */
  watch?: boolean
}

export const ENGINES: EngineDefinition[] = [
  { id: 'kie', codename: ENGINE_CODENAMES.kie, accounts: kieAccounts, cost: 'au jeton, selon le modèle Claude', probe: { submit: kieProbe } },
]

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'assistant',
    label: 'Assistant IA',
    watch: true,
    models: [{ id: 'assistant-texte', label: 'Assistant (texte)', engines: ['kie'] }],
  },
]

export const getEngine = (id: string) => ENGINES.find((engine) => engine.id === id) ?? null
export const getService = (id: string) => SERVICES.find((service) => service.id === id) ?? null
export const getModel = (id: string) => {
  for (const service of SERVICES) {
    const model = service.models.find((m) => m.id === id)
    if (model) return { service, model }
  }
  return null
}
