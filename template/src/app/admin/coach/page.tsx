import { CoachBoard } from './CoachBoard'
import { CoachQuestions } from './CoachQuestions'
import { CoachSettingsButton } from './CoachSettingsButton'

// Administration › Coach : le point du jour (comprendre en une minute, puis agir), et les questions libres.
export default function AdminCoachPage() {
  return (
    <main className="max-w-5xl space-y-8 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coach business</h1>
          <p className="text-sm text-gray-500">Chaque matin : ce qu’il faut comprendre, puis quoi faire, prêt à exécuter.</p>
        </div>
        <CoachSettingsButton />
      </div>
      <CoachBoard />
      <CoachQuestions />
    </main>
  )
}
