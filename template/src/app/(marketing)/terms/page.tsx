import type { Metadata } from 'next'
import { site } from '@/config/site'

export const metadata: Metadata = { title: "Conditions d'utilisation" }

// À RELIRE ET COMPLÉTER avant la mise en ligne : texte de départ, pas un avis juridique.
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold">Conditions d'utilisation</h1>
      <div className="space-y-4 text-gray-700">
        <p>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}.</p>
        <p>Ce document décrit les règles applicables à l'utilisation de {site.name}. Remplace ce texte par les conditions réelles de ton service.</p>
        <p>Contact : <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
      </div>
    </main>
  )
}
