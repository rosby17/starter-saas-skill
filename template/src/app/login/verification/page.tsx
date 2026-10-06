import { redirect } from 'next/navigation'
import { twoFactorContext } from '@/lib/auth/two-factor-session'
import { maskEmail } from '@/lib/auth/two-factor'
import { safeNext } from '@/lib/safe-next'
import { TwoFactorChallenge } from '@/components/auth/TwoFactorChallenge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Validation de la connexion' }

// Deuxième étape de la connexion : le middleware amène ici toute session dont le compte a activé
// la validation en deux étapes (par e-mail ou avec une application) tant que le code n'est pas saisi.
export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  const ctx = await twoFactorContext()
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!ctx.pending) redirect(next)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <TwoFactorChallenge method={ctx.pending} maskedEmail={maskEmail(ctx.user.email ?? '')} next={next} />
    </div>
  )
}
