// Motifs de suspension proposés à l'administrateur : un clic sur un motif suspend le compte ET envoie l'e-mail
// préétabli de ce motif (accountSuspendedTemplate), sans rien à rédiger. Le code du motif est gardé sur le profil
// (profiles.suspension_reason) et dans le journal d'audit. Ajouter un motif = une ligne ici, rien d'autre.

export const SUSPENSION_REASONS = [
  {
    code: 'adresse_jetable',
    label: 'Adresse e-mail temporaire ou jetable',
    email: 'L’adresse e-mail utilisée provient d’un service d’adresses temporaires. Nous n’acceptons que des adresses durables, pour protéger la plateforme contre la création de comptes en série.',
  },
  {
    code: 'domaine_sans_site',
    label: 'Domaine sans site web vérifiable',
    email: 'Le domaine de ton adresse e-mail ne correspond à aucun site ni à aucune activité que nous avons pu vérifier.',
  },
  {
    code: 'comptes_multiples',
    label: 'Comptes créés en série',
    email: 'Nous avons détecté plusieurs comptes créés à la suite par la même personne, ce que nos conditions ne permettent pas (par exemple pour cumuler les offres de bienvenue).',
  },
  {
    code: 'usage_abusif',
    label: 'Utilisation abusive du service',
    email: 'L’utilisation faite de ton compte ne respecte pas nos conditions d’utilisation.',
  },
  {
    code: 'paiement_conteste',
    label: 'Paiement contesté ou frauduleux',
    email: 'Un paiement lié à ton compte a été contesté ou signalé comme frauduleux.',
  },
] as const

export type SuspensionReason = (typeof SUSPENSION_REASONS)[number]
export type SuspensionReasonCode = SuspensionReason['code']

export function findSuspensionReason(code: unknown): SuspensionReason | undefined {
  return SUSPENSION_REASONS.find((r) => r.code === code)
}
