import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Pages de formation en plein écran (accueil du cours, leçons) : pas de menu, rien qui distrait l'élève.
// Le middleware protège déjà /cours ; on revérifie la session côté serveur.
export default async function ParcoursLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <div className="min-h-dvh bg-gray-50 text-gray-900">{children}</div>
}
