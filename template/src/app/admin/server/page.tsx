import { ServerResourcesPanel } from '@/components/admin/ServerResourcesPanel'

export const metadata = { title: 'Ressources serveur' }

export default function ServerResourcesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Supervision</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">Ressources serveur</h1>
        <p className="mt-1 text-sm text-gray-500">Processeur, mémoire et disque, actualisés toutes les 15 secondes, avec 24 h d&apos;historique.</p>
      </header>
      <ServerResourcesPanel />
    </div>
  )
}
