import Navbar from '@/components/site/Navbar'
import Contact from '@/components/site/Contact'

// Gabarit des pages légales (texte de départ à faire relire : ce n'est pas un avis juridique).
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
        <h1 className="mb-8 text-4xl text-gray-900">{title}</h1>
        <div className="legal space-y-4 text-[15px] leading-relaxed text-gray-700">{children}</div>
        <style>{`.legal h2 { margin-top: 32px; font-size: 22px; color: var(--white); } .legal a { color: var(--brand); text-decoration: underline; } .legal ul { padding-left: 20px; list-style: disc; }`}</style>
      </main>
      <Contact />
    </>
  )
}
