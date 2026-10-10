import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

const schema = z.object({
  bucket: z.enum(['videos', 'files']),
  productId: z.string().uuid(),
  filename: z.string().trim().min(1).max(200),
})

/**
 * Lien d'envoi signé (valable 2 h) vers le stockage PRIVÉ : le navigateur de l'administrateur envoie le fichier
 * directement au stockage, sans passer par le serveur du site (gros fichiers vidéo). Le fichier est rangé
 * dans le dossier du produit, avec un nom unique.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Fichier invalide.' }, { status: 400 })
  const { bucket, productId, filename } = parsed.data
  const clean = filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'fichier'
  const path = `${productId}/${Date.now().toString(36)}-${clean}`
  const { data, error } = await serviceClient().storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) {
    console.error("Lien d'envoi impossible :", error?.message)
    return NextResponse.json({ success: false, message: "Stockage indisponible : vérifie que la migration « boutique » est appliquée (espaces videos et files)." }, { status: 502 })
  }
  return NextResponse.json({ success: true, path: data.path, token: data.token, signedUrl: data.signedUrl })
}
