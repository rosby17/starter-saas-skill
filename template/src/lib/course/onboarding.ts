import { z } from 'zod'

// Questionnaire d'accueil d'une formation (une question par écran).
// Les réponses personnalisent l'écran « Ton parcours est prêt » et aident le formateur à suivre ses élèves.
// Générique : adapte les questions au sujet de TA formation (niveau, objectif, appareil, temps disponible).

export type Option = { value: string; label: string; hint?: string; icon?: string }
export type Question =
  | { id: string; kind: 'text'; title: string; subtitle?: string; placeholder?: string }
  | { id: string; kind: 'single' | 'multi'; title: string; subtitle?: string; why?: string; options: Option[]; exclusive?: string[] }

export const QUESTIONS: Question[] = [
  { id: 'firstName', kind: 'text', title: 'Comment veux-tu que je t’appelle ?', subtitle: 'Ton prénom, pour que la formation te parle à toi.', placeholder: 'Ton prénom' },
  {
    id: 'level', kind: 'single', title: 'Où en es-tu sur ce sujet ?',
    subtitle: 'Pas de mauvaise réponse : le parcours s’adapte.',
    options: [
      { value: 'zero', label: 'Je pars de zéro', hint: 'Je découvre', icon: 'Sprout' },
      { value: 'basics', label: 'J’ai quelques bases', hint: 'J’ai déjà essayé', icon: 'Scissors' },
      { value: 'pro', label: 'Je pratique déjà', hint: 'Je veux aller plus loin', icon: 'Clapperboard' },
    ],
  },
  {
    id: 'goal', kind: 'single', title: 'Qu’est-ce que tu veux en faire ?',
    subtitle: 'On garde ton objectif en tête à chaque module.',
    options: [
      { value: 'clients', label: 'En faire mon métier', hint: 'Vendre ce savoir-faire à des clients', icon: 'Briefcase' },
      { value: 'own', label: 'Pour mon propre projet', hint: 'Mon business, mes produits', icon: 'Rocket' },
      { value: 'skill', label: 'Apprendre une compétence', hint: 'Pour mon travail ou mes études', icon: 'Laptop' },
      { value: 'curious', label: 'Par curiosité', hint: 'Découvrir avant de me lancer', icon: 'MonitorPlay' },
    ],
  },
  {
    id: 'computer', kind: 'single', title: 'Sur quel appareil vas-tu suivre la formation ?',
    why: 'Certaines manipulations changent un peu selon l’appareil.',
    options: [
      { value: 'mac', label: 'Mac', icon: 'Laptop' },
      { value: 'windows', label: 'Windows', icon: 'Monitor' },
      { value: 'phone', label: 'Téléphone', icon: 'HardDrive' },
    ],
  },
  {
    id: 'time', kind: 'single', title: 'Combien de temps peux-tu y consacrer ?',
    subtitle: 'Je te propose un rythme réaliste.',
    options: [
      { value: '30min', label: '30 minutes par jour', icon: 'Coffee' },
      { value: '1h', label: '1 heure par jour', icon: 'Timer' },
      { value: 'weekend', label: 'Surtout le week-end', icon: 'CalendarDays' },
      { value: 'intensive', label: 'Je fonce : plusieurs heures par jour', icon: 'Zap' },
    ],
  },
]

export type Answers = Record<string, string | string[]>

export const answersSchema = z.record(z.string().regex(/^[a-zA-Z]{1,30}$/), z.union([z.string().trim().max(60), z.array(z.string().max(30)).max(10)]))

export const onboardingBodySchema = z.object({ answers: answersSchema, completed: z.boolean().default(false) })

const label = (id: string, value: string | string[] | undefined) => {
  const q = QUESTIONS.find((x) => x.id === id)
  if (!q || q.kind === 'text' || value === undefined) return ''
  const values = Array.isArray(value) ? value : [value]
  return values.map((v) => q.options.find((o) => o.value === v)?.label ?? v).join(', ')
}

/** Plan personnalisé (règles ou IA) : affiché à la fin du questionnaire et en haut du parcours. */
export type PersonalPlan = { intro?: string; start: string; goal: string; rhythm: string; install: string[]; focus?: string[]; summary: string[] }

/** Le plan calculé par des règles (repli quand l'IA n'est pas disponible). */
export function personalPlan(answers: Answers): PersonalPlan {
  const rhythm: Record<string, string> = {
    '30min': 'Une leçon par jour : avance sans te presser, chaque étape compte.',
    '1h': 'Une ou deux leçons par jour : le bon rythme pour progresser vite et retenir.',
    weekend: 'Un module par week-end : bloque ce moment dans ton agenda.',
    intensive: 'Un module par jour : fais chaque exercice avant de passer au suivant.',
  }
  const start =
    answers.level === 'zero'
      ? 'Commence par la première leçon et suis l’ordre : mets en pause et refais chaque étape chez toi.'
      : answers.level === 'pro'
        ? 'Survole les premières leçons et concentre-toi sur les modules avancés et les exercices.'
        : 'Suis les modules dans l’ordre : chaque leçon ajoute une couche de savoir-faire.'
  const goals: Record<string, string> = {
    clients: 'Garde en tête un vrai client à chaque module : les exercices sont ta première vitrine.',
    own: 'Applique chaque leçon directement à ton projet : tu avances en même temps que la formation.',
    skill: 'Note ce que tu retiens après chaque module et refais les exercices une semaine plus tard.',
    curious: 'Prends le temps de tester chaque étape : c’est en pratiquant que tu sauras si c’est fait pour toi.',
  }
  return {
    start,
    goal: goals[String(answers.goal)] ?? goals.own,
    rhythm: rhythm[String(answers.time)] ?? rhythm['1h'],
    install: [],
    summary: [label('level', answers.level), label('goal', answers.goal), label('computer', answers.computer)].filter(Boolean),
  }
}
