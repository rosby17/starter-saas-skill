// Filtres de la liste des comptes (partagés par l'écran et le serveur ; la première valeur est celle par défaut).
export const ACCOUNT_FILTER_VALUES = {
  account: ['live', 'suspended', 'internal', 'all'],
  activity: ['all', 'active', 'inactive', 'dormant', 'ever'],
  spent: ['all', 'yes', 'no'],
  risk: ['all', 'suspect', 'clean'],
} as const

export type AccountFilter = {
  q: string
  account: (typeof ACCOUNT_FILTER_VALUES.account)[number]
  activity: (typeof ACCOUNT_FILTER_VALUES.activity)[number]
  spent: (typeof ACCOUNT_FILTER_VALUES.spent)[number]
  risk: (typeof ACCOUNT_FILTER_VALUES.risk)[number]
}

export const DEFAULT_ACCOUNT_FILTER: AccountFilter = { q: '', account: 'live', activity: 'all', spent: 'all', risk: 'all' }

export const FILTER_LABELS = {
  account: { live: 'Comptes ouverts', suspended: 'Suspendus', internal: 'Internes (équipe, testeurs)', all: 'Tous les comptes' },
  activity: { all: 'Toute activité', active: 'Actifs (30 jours)', inactive: 'Inactifs depuis 30 jours', dormant: 'Jamais actifs', ever: 'Déjà actifs une fois' },
  spent: { all: 'Payants ou non', yes: 'Ont déjà payé ou consommé', no: 'N’ont jamais rien dépensé' },
  risk: { all: 'Tous les domaines', suspect: 'Adresse suspecte', clean: 'Adresse sûre' },
} as const

export const ACTIVITY_LABEL = { active: 'Actif', inactive: 'Inactif', dormant: 'Jamais actif' } as const
