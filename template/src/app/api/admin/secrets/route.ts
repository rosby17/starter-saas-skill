import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { logAdminAction } from '@/lib/auth/audit'
import { serviceClient } from '@/lib/auth/service-client'
import { getSecretDefinition } from '@/lib/secrets/catalog'
import { deleteSecret, getSecretsStatus, saveSecret } from '@/lib/secrets/store'

export const dynamic = 'force-dynamic'

// GET : état de chaque clé (jamais la valeur d'un secret). PUT : enregistre une clé. DELETE : revient à la valeur du serveur.
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  return NextResponse.json({ success: true, secrets: await getSecretsStatus() })
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''
  const value = typeof body?.value === 'string' ? body.value.trim() : ''
  if (!getSecretDefinition(name)) return NextResponse.json({ success: false, message: 'Clé inconnue.' }, { status: 400 })
  if (!value || value.length > 4096 || /[\r\n]/.test(value)) {
    return NextResponse.json({ success: false, message: 'Valeur vide, trop longue ou sur plusieurs lignes.' }, { status: 400 })
  }
  try {
    await saveSecret(name, value)
  } catch (error) {
    console.error('Enregistrement de clé impossible :', name, error)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible (migration 0007 appliquée ?).' }, { status: 500 })
  }
  await logAdminAction(serviceClient(), guard.userId, 'secret.set', { type: 'secret', id: name })
  return NextResponse.json({ success: true, secrets: await getSecretsStatus() })
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const name = new URL(request.url).searchParams.get('name') || ''
  if (!getSecretDefinition(name)) return NextResponse.json({ success: false, message: 'Clé inconnue.' }, { status: 400 })
  try {
    await deleteSecret(name)
  } catch (error) {
    console.error('Suppression de clé impossible :', name, error)
    return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 500 })
  }
  await logAdminAction(serviceClient(), guard.userId, 'secret.delete', { type: 'secret', id: name })
  return NextResponse.json({ success: true, secrets: await getSecretsStatus() })
}
