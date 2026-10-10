'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Film, X } from 'lucide-react'
import { clsx } from '@/lib/utils'

type Project = { path: string; title: string; aspect: '16/9' | '1/1' | '9/16' | '4/5'; name: string }

// Format de la vidéo d'après ses dimensions (pour l'afficher sans bandes noires).
function readAspect(file: File): Promise<Project['aspect']> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const r = v.videoWidth / (v.videoHeight || 1)
      URL.revokeObjectURL(v.src)
      resolve(r > 1.3 ? '16/9' : r > 0.9 ? '1/1' : r > 0.7 ? '4/5' : '9/16')
    }
    v.onerror = () => resolve('16/9')
    v.src = URL.createObjectURL(file)
  })
}

/** Avis de l'élève sur son cours : note de 1 à 5 et témoignage, publié tel quel (modifiable ensuite),
 *  avec la vidéo de son projet en option (preuve des résultats, publiée avec l'avis et dans la communauté). */
export function ReviewForm({ slug, eligible, reason, initial }: { slug: string; eligible: boolean; reason?: string; initial: { rating: number; title: string; body: string } | null }) {
  const router = useRouter()
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const pickVideo = async (file: File | undefined) => {
    if (!file) return
    setMsg(null)
    if (!file.type.startsWith('video/')) return setMsg({ ok: false, text: 'Choisis une vidéo (MP4 ou MOV).' })
    if (file.size > 100 * 1024 * 1024) return setMsg({ ok: false, text: 'Vidéo trop lourde : 100 Mo maximum. Exporte-la en 1080p.' })
    const signed = await fetch('/api/reviews/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productSlug: slug, filename: file.name, type: file.type, size: file.size }) }).then((r) => r.json()).catch(() => ({ success: false }))
    if (!signed.success) return setMsg({ ok: false, text: signed.message || 'Envoi impossible.' })
    const aspect = await readAspect(file)
    const url = signed.signedUrl.startsWith('http') ? signed.signedUrl : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${signed.signedUrl}`
    setProgress(0)
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', url)
        if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Envoi refusé (${xhr.status}).`)))
        xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'))
        const form = new FormData()
        form.append('cacheControl', '3600')
        form.append('', file, file.name)
        xhr.send(form)
      })
      setProject({ path: signed.path, title: '', aspect, name: file.name })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
    setProgress(null)
  }

  const send = async () => {
    setBusy(true); setMsg(null)
    const d = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productSlug: slug, rating, title, body, project: project ? { path: project.path, title: project.title, aspect: project.aspect } : undefined }) }).then((r) => r.json()).catch(() => ({ success: false }))
    setBusy(false)
    setMsg({ ok: !!d.success, text: d.message || (d.success ? 'Merci !' : 'Erreur.') })
    if (d.success) { setProject(null); router.refresh() }
  }
  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-surface p-6">
      <div>
        <h2 className="text-2xl">{initial ? 'Ton avis' : 'Donne ton avis'}</h2>
        <p className="text-sm text-gray-500">Ton avis est public, avec la mention « Achat vérifié » et ta progression. Positif ou négatif, il est publié tel quel : il aide les futurs élèves.</p>
      </div>
      {!eligible ? <p className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600">{reason}</p> : (
        <>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
                className={clsx('grid h-11 w-11 place-items-center rounded-lg transition-colors', i <= (hover || rating) ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400')}>
                <Star className="h-6 w-6" fill="currentColor" />
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ton avis en une phrase (facultatif)" className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-2.5 outline-none focus:border-brand" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} placeholder="Ce que tu as appris, ce qui t’a aidé, ce qui pourrait être mieux…" className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-3 outline-none focus:border-brand" />
          <div className="rounded-2xl border border-dashed border-gray-300 p-4">
            <p className="font-medium text-gray-900">Ton projet (facultatif, mais très attendu)</p>
            <p className="mt-1 text-sm text-gray-500">Joins la vidéo de ce que tu as réalisé avec la formation : elle est publiée avec ton avis et dans la communauté. C’est la meilleure preuve pour les futurs élèves.</p>
            <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = '' }} />
            {project ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-3 py-2 text-sm">
                  <Film className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="text-green-700">Envoyée ✓</span>
                  <button type="button" onClick={() => setProject(null)} aria-label="Retirer la vidéo" className="text-gray-500 hover:text-gray-900"><X className="h-4 w-4" /></button>
                </div>
                <input value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} maxLength={120} placeholder="Titre du projet (ex. Pub pour une boutique de montres)" className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-2.5 outline-none focus:border-brand" />
              </div>
            ) : progress !== null ? (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-1 text-xs text-gray-500">Envoi de la vidéo… {progress} %</p>
              </div>
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-brand"><Film className="h-4 w-4" />Ajouter la vidéo de mon projet</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={send} disabled={busy || progress !== null || !rating || body.trim().length < 10} className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">{busy ? 'Envoi…' : initial ? 'Mettre à jour mon avis' : 'Publier mon avis'}</button>
            {msg && <p className={clsx('text-sm', msg.ok ? 'text-green-700' : 'text-red-700')}>{msg.text}</p>}
          </div>
        </>
      )}
    </section>
  )
}
