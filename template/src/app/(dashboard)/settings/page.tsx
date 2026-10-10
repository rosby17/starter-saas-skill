import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { ProBadge } from '@/components/ProBadge'
import { TwoFactorSettings } from '@/components/auth/TwoFactorSettings'
import { googleEnabled } from '@/lib/auth/providers'
import { STATUS_LABEL, avatarOf, memberStatuses } from '@/lib/profile/identity'
import { AvatarEditor, DataControls, GoogleConnection, IdentityForm } from './AccountParts'

export const metadata: Metadata = { title: 'Mon compte' }

async function changePassword(formData: FormData) {
  'use server'
  const password = String(formData.get('password') || '')
  if (password.length < 8) return
  const supabase = await createClient()
  await supabase.auth.updateUser({ password })
  revalidatePath('/settings')
}

function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-3xl border border-gray-200 bg-surface p-6 md:grid-cols-[240px_1fr] md:gap-8">
      <div>
        <h2 className="text-lg">{title}</h2>
        {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

// Mon compte : identité (photo, nom, pseudo, présentation, statut), sécurité (mot de passe, deux étapes, Google)
// et données personnelles (téléchargement, suppression).
export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = serviceClient()
  const [{ data: profile }, statuses, google] = await Promise.all([
    supabase.from('profiles').select('full_name, username, bio, phone, country, avatar_url, is_admin, created_at').eq('id', user!.id).maybeSingle(),
    memberStatuses(db, [user!.id]),
    googleEnabled(),
  ])
  const status = statuses.get(user!.id) ?? 'inscrit'
  const name: string = profile?.full_name || user!.email || ''
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]!.toUpperCase()).join('')
  const identities = user!.identities ?? []
  const googleLinked = identities.some((i) => i.provider === 'google')

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <section className="flex flex-col items-center gap-6 rounded-3xl border border-gray-200 bg-surface p-6 text-center md:flex-row md:text-left">
        <AvatarEditor url={avatarOf(profile?.avatar_url, user!.user_metadata)} initials={initials} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <h1 className="text-3xl">{name}</h1>
            {status === 'pro' && <ProBadge />}
            {status === 'admin' && <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">Fondateur</span>}
            {status === 'eleve' && <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-800">Élève</span>}
            {status === 'inscrit' && <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">{STATUS_LABEL.inscrit}</span>}
          </div>
          <p className="mt-1 text-gray-500">{profile?.username ? `@${profile.username} · ` : ''}{user!.email}</p>
          {profile?.bio && <p className="mt-2 text-gray-700">{profile.bio}</p>}
          <p className="mt-2 text-xs text-gray-500">Membre depuis le {new Date(profile?.created_at ?? user!.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </section>

      <Section title="Mon identité" text="Ton nom, ta photo et ton pseudo apparaissent dans la communauté.">
        <IdentityForm initial={{ full_name: profile?.full_name ?? '', username: profile?.username ?? '', bio: profile?.bio ?? '', phone: profile?.phone ?? '', country: profile?.country ?? '' }} />
      </Section>

      <Section title="Connexion" text="Les façons de te connecter à ton compte.">
        <div className="space-y-6">
          <GoogleConnection linked={googleLinked} available={google} canUnlink={identities.length > 1} />
          <div className="border-t border-gray-200 pt-6">
            <p className="font-medium">Mot de passe (facultatif)</p>
            <p className="mb-3 text-sm text-gray-500">Tu peux toujours te connecter avec un lien reçu par e-mail. Un mot de passe évite d’attendre l’e-mail.</p>
            <form action={changePassword} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1"><PasswordInput name="password" minLength={8} placeholder="Nouveau mot de passe (8 caractères minimum)" required autoComplete="new-password" /></div>
              <Button type="submit" variant="secondary" className="rounded-full">Enregistrer</Button>
            </form>
          </div>
        </div>
      </Section>

      <Section title="Sécurité" text="Validation en deux étapes : un code en plus du mot de passe, par e-mail ou avec une application comme Google Authenticator.">
        <TwoFactorSettings />
      </Section>

      <Section title="Mes données" text="Tes droits sur tes données personnelles (RGPD) : les télécharger ou tout effacer.">
        <DataControls isAdmin={!!profile?.is_admin} />
      </Section>
    </main>
  )
}
