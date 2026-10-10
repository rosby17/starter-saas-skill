'use client'

import { clsx } from '@/lib/utils'

// Petits éléments communs aux écrans de l'administration (aux couleurs du site, aucun élément natif interdit).

export const inputClass = 'w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-gray-400'

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block space-y-1.5 text-sm', className)}>
      <span className="text-gray-600">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

export function Notice({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'red'; children: React.ReactNode }) {
  const tones = { gray: 'border-gray-200 bg-gray-50', green: 'border-green-200 bg-green-50 text-green-700', red: 'border-red-200 bg-red-50 text-red-700' }
  return <div role="status" className={clsx('rounded-xl border p-3 text-sm', tones[tone])}>{children}</div>
}

export async function api<T = Record<string, unknown>>(url: string, method = 'GET', body?: unknown): Promise<T & { success: boolean; message?: string }> {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  return res.json().catch(() => ({ success: false, message: `Erreur ${res.status}` }))
}

/**
 * Envoie un fichier dans le stockage PRIVÉ (videos ou files) avec un lien d'envoi signé demandé au serveur :
 * le fichier va directement du navigateur au stockage, avec la progression. Renvoie le chemin enregistré.
 */
export async function uploadToStorage(bucket: 'videos' | 'files', productId: string, file: File, onProgress: (percent: number) => void): Promise<string> {
  const signed = await api<{ path: string; signedUrl: string }>('/api/admin/upload-url', 'POST', { bucket, productId, filename: file.name })
  if (!signed.success) throw new Error(signed.message || "Envoi impossible.")
  const url = signed.signedUrl.startsWith('http') ? signed.signedUrl : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${signed.signedUrl}`
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('x-upsert', 'false')
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? 'Fichier trop gros pour le stockage : augmente FILE_SIZE_LIMIT du service Supabase (voir le README).' : `Envoi refusé (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'))
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', file)
    xhr.send(form)
  })
  return signed.path
}

/** Durée d'une vidéo locale (en secondes), lue par le navigateur avant l'envoi. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null) }
    video.onerror = () => resolve(null)
    video.src = URL.createObjectURL(file)
  })
}
