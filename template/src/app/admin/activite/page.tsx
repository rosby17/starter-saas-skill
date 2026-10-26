import { ActivityFeed } from './ActivityFeed'

// Administration › Activité : le fil de tout ce qui se passe sur le site, en direct, échecs compris.
export default function AdminActivityPage() {
  return (
    <main className="max-w-6xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Activité en direct</h1>
        <p className="text-sm text-gray-500">Qui fait quoi, d’où, et avec quel succès : inscriptions, commandes, demandes, et chaque action notée par le site.</p>
      </div>
      <ActivityFeed />
    </main>
  )
}
