// Regroupements de la page Revenus (fichier sans import serveur : partagé par la page et l'API).
export type Group = 'hour' | 'day' | 'week' | 'month' | 'year'
export const GROUPS: Group[] = ['hour', 'day', 'week', 'month', 'year']
/** Au-delà, le regroupement par heure ferait trop de barres : on passe au jour. */
export const MAX_HOURLY_DAYS = 7
