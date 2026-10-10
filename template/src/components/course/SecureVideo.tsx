'use client'

import { useCallback, useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'
import { youtubeEmbed, type Ratio } from '@/lib/course/blocks'

const aspect: Record<Ratio, string> = { '16/9': 'aspect-video', '9/16': 'aspect-[9/16]', '4/5': 'aspect-[4/5]', '1/1': 'aspect-square' }

// Vidéo d'un cours. Stockage privé : lien signé court, pas de téléchargement, clic droit coupé,
// filigrane avec l'e-mail du client qui se déplace. YouTube : lecteur sans cookies.
export function SecureVideo({ src, youtube, email, ratio = '16/9', onExpired, className }: {
  src?: string | null
  youtube?: string | null
  email: string
  ratio?: Ratio
  onExpired?: () => void
  className?: string
}) {
  const embed = youtube ? youtubeEmbed(youtube) : null
  return (
    <div className={clsx('relative w-full overflow-hidden rounded-2xl bg-black', aspect[ratio], className)} onContextMenu={(e) => e.preventDefault()}>
      {embed ? (
        <iframe src={embed} title="Vidéo de la leçon" className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
      ) : src ? (
        <>
          <video key={src} src={src} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline preload="metadata"
            className="h-full w-full" onError={onExpired} />
          <span aria-hidden className="pointer-events-none absolute left-0 top-0 select-none text-xs font-medium text-white/35" style={{ animation: 'watermarkDrift 40s ease-in-out infinite' }}>
            {email}
          </span>
        </>
      ) : (
        <div className="grid h-full place-items-center text-sm text-white/60">Chargement de la vidéo…</div>
      )}
    </div>
  )
}

/** Lien signé de la vidéo principale d'une leçon (/api/lessons/:id/play), redemandé s'il expire. */
export function useLessonVideo(lessonId: string, enabled: boolean) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setSrc(null)
    setError('')
    const res = await fetch(`/api/lessons/${lessonId}/play`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (data.success) setSrc(data.url)
    else setError(data.message || 'Vidéo indisponible pour le moment.')
  }, [lessonId])
  useEffect(() => { if (enabled) void load() }, [enabled, load])
  return { src, error, reload: load }
}

/** Liens signés de tous les médias des étapes d'une leçon, en une seule demande. */
export function useLessonMedia(lessonId: string, enabled: boolean) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    const res = await fetch(`/api/lessons/${lessonId}/media`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (data.success) setUrls(data.urls ?? {})
    else setError(data.message || 'Médias indisponibles pour le moment.')
  }, [lessonId])
  useEffect(() => { if (enabled) void load() }, [enabled, load])
  return { urls, error, reload: load }
}
