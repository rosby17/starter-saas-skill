'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { clsx } from '@/lib/utils'

const time = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

// Lecteur audio aux couleurs du site (le lecteur natif du navigateur est interdit : il propose aussi le téléchargement).
// Un seul son à la fois : lancer un lecteur met les autres en pause.
export function AudioPlayer({ src, onError }: { src?: string; onError?: () => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const stopOthers = (e: Event) => { if (e.target !== audio.current) audio.current?.pause() }
    document.addEventListener('play', stopOthers, true)
    return () => document.removeEventListener('play', stopOthers, true)
  }, [])

  const toggle = () => {
    const a = audio.current
    if (!a || !src) return
    if (a.paused) void a.play()
    else a.pause()
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current
    if (!a || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration
  }
  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className="flex items-center gap-4" onContextMenu={(e) => e.preventDefault()}>
      <button type="button" onClick={toggle} disabled={!src} aria-label={playing ? 'Pause' : 'Écouter'}
        className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40', playing ? 'bg-brand-hover' : 'bg-brand hover:bg-brand-hover')}>
        {playing ? <Pause className="h-5 w-5" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(current)} tabIndex={0}
          onClick={seek}
          onKeyDown={(e) => { const a = audio.current; if (!a) return; if (e.key === 'ArrowRight') a.currentTime += 5; if (e.key === 'ArrowLeft') a.currentTime -= 5 }}
          className="group relative h-2 cursor-pointer rounded-full bg-gray-200">
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow opacity-0 transition-opacity group-hover:opacity-100" style={{ left: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-gray-500"><span>{time(current)}</span><span>{time(duration)}</span></div>
      </div>
      {src && (
        <audio ref={audio} src={src} preload="metadata" className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={onError} />
      )}
    </div>
  )
}
