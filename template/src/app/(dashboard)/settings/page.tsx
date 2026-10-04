import { createClient } from '@/lib/supabase/server'
import { PasswordInput } from '@/components/ui/password-input'
import { revalidatePath } from 'next/cache'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountDataActions } from '@/components/AccountDataActions'

async function saveProfile(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const first_name = String(formData.get('first_name') || '').trim().slice(0, 80)
  const { error } = await supabase.from('profiles').update({ first_name }).eq('id', user.id)
  if (error) throw new Error('Le prénom n’a pas été enregistré. Réessaie dans un instant.')
  revalidatePath('/settings')
}

async function changePassword(formData: FormData) {
  'use server'
  const password = String(formData.get('password') || '')
  if (password.length < 8) return
  const supabase = await createClient()
  await supabase.auth.updateUser({ password })
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user!.id).maybeSingle()

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Mon compte</h1>
      <Card>
        <h2 className="mb-4 font-semibold">Profil</h2>
        <form action={saveProfile} className="space-y-3">
          <p className="text-sm text-gray-500">{user!.email}</p>
          <Input name="first_name" defaultValue={profile?.first_name ?? ''} placeholder="Prénom" />
          <Button type="submit">Enregistrer</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Mot de passe</h2>
        <form action={changePassword} className="space-y-3">
          <PasswordInput name="password" minLength={8} placeholder="Nouveau mot de passe (8 caractères minimum)" required />
          <Button type="submit" variant="secondary">Changer le mot de passe</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Mes données</h2>
        <p className="mb-4 text-sm text-gray-500">Récupère tout ce que nous gardons sur toi, ou supprime ton compte.</p>
        <AccountDataActions />
      </Card>
    </main>
  )
}
