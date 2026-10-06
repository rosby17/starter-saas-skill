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

// PUT { name, value } ou { values: { NOM: valeur, … } } (fenêtre d'un service : plusieurs clés d'un coup).
// Les valeurs vides sont ignorées : « laisser vide pour garder la valeur actuelle ».
export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const body = await request.json().catch(() => null)
  const entries: Array<[string, string]> = body?.values && typeof body.values === 'object'
    ? Object.entries(body.values as Record<string, unknown>).map(([n, v]) => [n, typeof v === 'string' ? v.trim() : ''])
    : [[typeof body?.name === 'string' ? body.name : '', typeof body?.value === 'string' ? body.value.trim() : '']]
  const toSave = entries.filter(([, value]) => value)
  if (!toSave.length) return NextResponse.json({ success: false, message: 'Rien à enregistrer : remplis au moins un champ.' }, { status: 400 })
  for (const [name, value] of toSave) {
    if (!getSecretDefinition(name)) return NextResponse.json({ success: false, message: `Clé inconnue : ${name}.` }, { status: 400 })
    if (value.length > 4096 || /[\r\n]/.test(value)) {
      return NextResponse.json({ success: false, message: `${name} : valeur trop longue ou sur plusieurs lignes.` }, { status: 400 })
    }
  }
  for (const [name, value] of toSave) {
    try {
      await saveSecret(name, value)
    } catch (error) {
      console.error('Enregistrement de clé impossible :', name, error)
      return NextResponse.json({ success: false, message: `Enregistrement de ${name} impossible (migration 0007 appliquée ?).` }, { status: 500 })
    }
    await logAdminAction(serviceClient(), guard.userId, 'secret.set', { type: 'secret', id: name })
  }
  return NextResponse.json({ success: true, saved: toSave.map(([name]) => name), secrets: await getSecretsStatus() })
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
