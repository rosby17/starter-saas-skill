// Demandes (coaching, accompagnements, projets sur devis, audits) : questions posées pour chaque type.
// Générique : adapte les questions à ton activité. Utilisable côté navigateur et serveur.
import type { RequestKind } from '@/lib/catalog/types'

export type Question = { id: string; label: string; placeholder?: string; long?: boolean; options?: string[]; required?: boolean }

export const REQUEST_FORMS: Record<RequestKind, { title: string; intro: string; questions: Question[] }> = {
  coaching: {
    title: 'Formulaire de départ : coaching',
    intro: 'Ces réponses permettent de préparer ta séance.',
    questions: [
      { id: 'lien', label: 'Lien de ton projet (site, page, chaîne…), si tu en as un', placeholder: 'https://…' },
      { id: 'niveau', label: 'Où en es-tu ?', options: ['Je démarre', 'C’est lancé, je veux progresser', 'Ça marche, je veux grandir'], required: true },
      { id: 'objectif', label: 'Ton objectif dans les 3 prochains mois', long: true, required: true },
      { id: 'disponibilites', label: 'Tes disponibilités pour la séance (jours, heures, fuseau)', placeholder: 'Ex. mardi ou jeudi après 18 h', required: true },
    ],
  },
  accompagnement: {
    title: 'Formulaire de départ : accompagnement',
    intro: 'Décris ton projet : tu reçois un plan d’accompagnement.',
    questions: [
      { id: 'projet', label: 'Ton projet en quelques phrases', long: true, required: true },
      { id: 'niveau', label: 'Ton niveau sur le sujet', options: ['Débutant', 'Intermédiaire', 'Avancé'], required: true },
      { id: 'objectif', label: 'Ce que tu veux avoir obtenu à la fin', long: true, required: true },
      { id: 'delai', label: 'Ton délai', placeholder: 'Dans 1 mois, 3 mois…' },
    ],
  },
  projet: {
    title: 'Ton projet sur mesure',
    intro: 'Décris ce que tu veux : tu reçois une proposition et un devis.',
    questions: [
      { id: 'projet', label: 'Décris ton projet', long: true, required: true },
      { id: 'exemples', label: 'Des exemples que tu aimes (liens)', placeholder: 'https://…' },
      { id: 'delai', label: 'Délai souhaité' },
      { id: 'budget', label: 'Budget approximatif (FCFA)' },
    ],
  },
  design: {
    title: 'Design graphique',
    intro: 'Logo, visuels, supports : décris ton besoin, tu reçois un devis.',
    questions: [
      { id: 'support', label: 'Ce qu’il te faut', options: ['Logo / charte', 'Flyer / affiche', 'Visuels réseaux sociaux', 'Autre'], required: true },
      { id: 'marque', label: 'Ta marque et ton activité', long: true, required: true },
      { id: 'style', label: 'Le style que tu veux (couleurs, exemples)' },
      { id: 'delai', label: 'Pour quand ?' },
    ],
  },
  audit: {
    title: 'Audit',
    intro: 'Explique ta situation : tu reçois un diagnostic et un plan d’action.',
    questions: [
      { id: 'lien', label: 'Lien de ce qu’il faut auditer', placeholder: 'https://…', required: true },
      { id: 'probleme', label: 'Ce qui bloque, en détail', long: true, required: true },
    ],
  },
  autre: {
    title: 'Ta demande',
    intro: 'Explique ce dont tu as besoin : on te répond rapidement.',
    questions: [{ id: 'message', label: 'Ton message', long: true, required: true }],
  },
}

export const REQUEST_STATUS: Record<string, { label: string; tone: 'gray' | 'green' | 'red' | 'amber' }> = {
  nouvelle: { label: 'Reçue', tone: 'amber' },
  en_cours: { label: 'En cours', tone: 'amber' },
  terminee: { label: 'Terminée', tone: 'green' },
  annulee: { label: 'Annulée', tone: 'gray' },
}
