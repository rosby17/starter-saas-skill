'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { CreditAdjustmentForm } from '@/components/admin/CreditAdjustmentForm'
import { UserSearch, type FoundUser } from '@/components/admin/UserSearch'

const who = (u: FoundUser) => (u.first_name ? `${u.first_name} (${u.email})` : u.email)

// Outils de la page Utilisateurs : on choisit le compte avec la recherche (suggestions pendant la frappe).
export function UserTools() {
  const [creditUser, setCreditUser] = useState<FoundUser | null>(null)
  const [roleUser, setRoleUser] = useState<FoundUser | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()
  const router = useRouter()

  const setAdmin = async (user: FoundUser, isAdmin: boolean) => {
    const ok = await confirm({
      title: isAdmin ? `Donner l’accès administrateur à ${user.email} ?` : `Retirer l’accès administrateur de ${user.email} ?`,
      message: isAdmin ? 'Cette personne pourra voir tous les comptes, les paiements et les clés.' : 'Elle gardera son compte client.',
      confirmLabel: isAdmin ? 'Donner l’accès' : 'Retirer l’accès',
      danger: isAdmin,
    })
    if (!ok) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin }) })
      const data = await res.json()
      setMessage({ ok: data.success, text: data.success ? `${user.email} ${isAdmin ? 'est maintenant administrateur' : 'n’est plus administrateur'}.` : data.message })
      if (data.success) { setRoleUser({ ...user, is_admin: isAdmin }); router.refresh() }
    } catch {
      setMessage({ ok: false, text: 'Modification impossible : vérifie ta connexion.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold">Ajouter ou retirer des crédits</h2>
        <p className="mb-3 text-sm text-gray-500">Choisis le compte, puis le nombre de crédits (+500, −200) et la raison.</p>
        <UserSearch onSelect={setCreditUser} />
        {creditUser && (
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            <p className="mb-2 text-sm">Compte choisi : <b>{who(creditUser)}</b></p>
            <CreditAdjustmentForm userId={creditUser.id} onDone={() => router.refresh()} />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Accès administrateur</h2>
        <p className="mb-3 text-sm text-gray-500">Donne ou retire l’accès à l’administration.</p>
        <UserSearch onSelect={(u) => { setRoleUser(u); setMessage(null) }} already={(u) => u.is_admin && 'déjà administrateur'} />
        {roleUser && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm">
            <span className="min-w-0 flex-1">Compte choisi : <b>{who(roleUser)}</b>{roleUser.is_admin ? ' · administrateur' : ''}</span>
            <Button type="button" disabled={busy} variant={roleUser.is_admin ? 'secondary' : 'primary'} onClick={() => setAdmin(roleUser, !roleUser.is_admin)}>
              {roleUser.is_admin ? 'Retirer l’accès' : 'Donner l’accès'}
            </Button>
          </div>
        )}
        {message && <p role="status" className={`mt-3 text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>}
      </Card>
    </div>
  )
}
