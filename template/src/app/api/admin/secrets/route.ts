import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { logAdminAction } from '@/lib/auth/audit'
import { serviceClient } from '@/lib/auth/service-client'
import { getSecretDefinition } from '@/lib/secrets/catalog'
import { deleteSecret, getSecretValues, getSecretsStatus, saveSecret } from '@/lib/secrets/store'

export const dynamic = 'force-dynamic'

// GET : état de chaque clé ; avec ?values=NOM1,NOM2 : leurs valeurs entières pour pré-remplir la fenêtre d'un service
// (administrateur seulement, jamais mis en cache, consultation journalisée). PUT : enregistre. DELETE : revient à la valeur du serveur.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const wanted = new URL(request.url).searchParams.get('values')
  if (wanted) {
    const names = wanted.split(',').filter((n) => getSecretDefinition(n)).slice(0, 30)
    await logAdminAction(serviceClient(), guard.userId, 'secret.view', { type: 'secret', id: names.join(',') })
    return NextResponse.json({ success: true, values: getSecretValues(names) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ success: true, secrets: await getSecretsStatus() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const body = await request.json().catch(() => null)
  // Une clé ({ name, value }) ou toutes celles d'un service ({ values: { NOM: valeur } }, les vides sont ignorées).
  const entries: Array<[string, string]> = body?.values && typeof body.values === 'object'
    ? Object.entries(body.values as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()])
    : [[typeof body?.name === 'string' ? body.name : '', typeof body?.value === 'string' ? body.value.trim() : '']]
  if (!entries.length) return NextResponse.json({ success: false, message: 'Rien à enregistrer.' }, { status: 400 })
  for (const [name, value] of entries) {
    if (!getSecretDefinition(name)) return NextResponse.json({ success: false, message: 'Clé inconnue.' }, { status: 400 })
    if (!value || value.length > 4096 || /[\r\n]/.test(value)) {
      return NextResponse.json({ success: false, message: `${name} : valeur vide, trop longue ou sur plusieurs lignes.` }, { status: 400 })
    }
  }
  for (const [name, value] of entries) {
    try {
      await saveSecret(name, value)
    } catch (error) {
      console.error('Enregistrement de clé impossible :', name, error)
      return NextResponse.json({ success: false, message: 'Enregistrement impossible (migration 0007 appliquée ?).' }, { status: 500 })
    }
    await logAdminAction(serviceClient(), guard.userId, 'secret.set', { type: 'secret', id: name })
  }
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
