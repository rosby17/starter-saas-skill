'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from '@/lib/utils'
import { Lock, Check, ChevronDown, PlayCircle, FileText } from 'lucide-react'
import { readingMinutes, type Block } from '@/lib/course/blocks'
import { LessonBlocks } from '@/components/course/LessonBlocks'
import { SecureVideo, useLessonMedia, useLessonVideo } from '@/components/course/SecureVideo'

export type OutlineItem = { id: string; section: string | null; title: string; duration: number | null; unlocked: boolean }
type Lesson = {
  id: string; section: string | null; title: string; summary: string | null; description: string | null
  youtube: string | null; hasVideo: boolean; duration: number | null; blocks: Block[]; locked?: boolean
}

// Lecteur de leçon : sommaire fixe à gauche sur ordinateur (modules, progression, leçon en cours),
// tiroir sur téléphone ; objectif de la leçon, vidéo, étapes détaillées, puis « J'ai terminé ».
export function LessonView({ slug, courseTitle, email, outline, completed, unlockHref, lesson }: {
  slug: string; courseTitle: string; email: string; outline: OutlineItem[]; completed: string[]; unlockHref: string; lesson: Lesson
}) {
  const router = useRouter()
  const [done, setDone] = useState(() => new Set(completed))
  const [saving, setSaving] = useState(false)
  const [menu, setMenu] = useState(false)
  const video = useLessonVideo(lesson.id, lesson.hasVideo && !lesson.locked)
  const media = useLessonMedia(lesson.id, lesson.blocks.length > 0 && !lesson.locked)

  const index = outline.findIndex((l) => l.id === lesson.id)
  const next = outline[index + 1]
  const prev = outline[index - 1]
  const inSection = outline.filter((l) => l.section === lesson.section)
  const posInSection = inSection.findIndex((l) => l.id === lesson.id) + 1
  const progress = outline.length ? outline.filter((l) => done.has(l.id)).length / outline.length : 0
  const minutes = readingMinutes(lesson.blocks, lesson.description, lesson.hasVideo || lesson.youtube ? lesson.duration : 0)
  const isDone = done.has(lesson.id)

  // Temps passé sur la leçon (statistiques) : 30 s comptées à chaque tranche, seulement si l'onglet est visible.
  useEffect(() => {
    if (lesson.locked) return
    const supabase = createClient()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void supabase.rpc('track_lesson_time', { p_lesson_id: lesson.id, p_seconds: 30 })
    }, 30_000)
    return () => clearInterval(t)
  }, [lesson.id, lesson.locked])

  const complete = async () => {
    setSaving(true)
    if (!isDone) {
      const res = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, done: true }) }).catch(() => null)
      if (res?.ok) setDone(new Set(done).add(lesson.id))
    }
    setSaving(false)
    router.push(next ? `/cours/${slug}/lecon/${next.id}` : `/cours/${slug}?fini=1`)
  }

  const undo = async () => {
    const res = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, done: false }) }).catch(() => null)
    if (res?.ok) { const c = new Set(done); c.delete(lesson.id); setDone(c) }
  }

  const doneCount = outline.filter((l) => done.has(l.id)).length

  return (
    <div className="flex min-h-dvh flex-col lg:pl-80 xl:pl-96">
      {/* Sommaire permanent (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-80 flex-col border-r border-gray-200 bg-surface lg:flex xl:w-96" aria-label="Sommaire du cours">
        <div className="border-b border-gray-200 p-5">
          <Link href={`/cours/${slug}`} className="text-xs text-gray-500 hover:text-gray-900">← Accueil du cours</Link>
          <p className="mt-2 text-lg font-medium leading-snug text-gray-900">{courseTitle}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">{doneCount} leçon{doneCount > 1 ? 's' : ''} terminée{doneCount > 1 ? 's' : ''} sur {outline.length} · {Math.round(progress * 100)} %</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Outline outline={outline} done={done} current={lesson.id} slug={slug} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-gray-50/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3 sm:px-8">
          <Link href={`/cours/${slug}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Retour au parcours">←</Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-gray-500">{courseTitle}</p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(2, progress * 100)}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-xs text-gray-500">{index + 1} / {outline.length}</span>
          <button type="button" onClick={() => setMenu(true)} className="shrink-0 rounded-full border border-gray-300 px-3 py-1.5 text-xs hover:border-brand">Sommaire</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-48 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <div style={{ animation: 'courseRise 0.4s ease-out both' }}>
          {lesson.section && <p className="text-xs uppercase tracking-[0.2em] text-brand">{lesson.section}{inSection.length > 1 ? ` · leçon ${posInSection} sur ${inSection.length}` : ''}</p>}
          <h1 className="mt-3 text-[34px] leading-tight sm:text-5xl">{lesson.title}</h1>
          <p className="mt-3 text-sm text-gray-500">≈ {minutes} min{isDone ? ' · ✓ terminée' : ''}</p>
        </div>

        {lesson.locked ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-surface p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-700"><Lock className="h-6 w-6" strokeWidth={1.8} /></span>
            <p className="mt-3 text-lg font-medium">Nouveauté réservée aux abonnés</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">Ta formation reste à toi à vie. Cette leçon est sortie après ton achat : l’abonnement débloque toutes les nouveautés et le support.</p>
            {lesson.summary && <p className="mx-auto mt-4 max-w-md text-sm text-gray-500">Au programme : {lesson.summary}</p>}
            <Link href={unlockHref} className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover">Débloquer avec l’abonnement</Link>
          </div>
        ) : (
          <>
            {lesson.summary && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-surface px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Dans cette leçon</p>
                <p className="mt-1 text-[18px] leading-8 text-gray-900">{lesson.summary}</p>
              </div>
            )}

            {(lesson.hasVideo || lesson.youtube) && (
              <div className="mt-6">
                <SecureVideo src={video.src} youtube={lesson.youtube} email={email} onExpired={video.reload} />
                {video.error && <p className="mt-2 text-sm text-red-700">{video.error}</p>}
              </div>
            )}

            {lesson.blocks.length > 0 ? (
              <div className="mt-8">
                {media.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{media.error} <button type="button" onClick={media.reload} className="underline">Réessayer</button></p>}
                <LessonBlocks blocks={lesson.blocks} urls={media.urls} email={email} onExpired={media.reload} />
              </div>
            ) : lesson.description ? (
              <div className="mt-8 whitespace-pre-line text-[18px] leading-8 text-gray-700">{lesson.description}</div>
            ) : null}
          </>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-gray-50/95 backdrop-blur lg:left-80 xl:left-96">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4 sm:px-8 lg:px-12">
          {prev ? (
            <Link href={`/cours/${slug}/lecon/${prev.id}`} className="flex min-w-0 items-center gap-2 rounded-full border border-gray-300 px-4 py-2.5 text-sm hover:border-brand">
              ← <span className="hidden sm:inline">Précédente</span>
              <span className="hidden max-w-56 truncate text-gray-500 xl:inline">· {prev.title}</span>
            </Link>
          ) : <span />}
          <div className="flex-1" />
          {isDone && !lesson.locked && <button type="button" onClick={undo} className="hidden text-xs text-gray-500 hover:text-gray-900 sm:block">Marquer comme non terminée</button>}
          {lesson.locked ? (
            next && <Link href={`/cours/${slug}/lecon/${next.id}`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Leçon suivante →</Link>
          ) : (
            <button type="button" onClick={complete} disabled={saving} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">
              {next ? (isDone ? 'Leçon suivante →' : 'J’ai terminé · suivante →') : (isDone ? 'Retour au parcours' : 'J’ai terminé le parcours')}
            </button>
          )}
        </div>
      </footer>

      {menu && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setMenu(false)} role="presentation">
          <nav className="h-full w-full max-w-sm overflow-y-auto bg-gray-50 p-5" onClick={(e) => e.stopPropagation()} aria-label="Sommaire du cours" style={{ animation: 'courseRise 0.25s ease-out both' }}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Sommaire</p>
              <button type="button" onClick={() => setMenu(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100" aria-label="Fermer">✕</button>
            </div>
            <Outline outline={outline} done={done} current={lesson.id} slug={slug} />
          </nav>
        </div>
      )}
    </div>
  )
}

export function Outline({ outline, done, current, slug }: { outline: OutlineItem[]; done: Set<string>; current?: string; slug: string }) {
  const sections = [...new Set(outline.map((l) => l.section ?? ''))]
  const currentSection = outline.find((l) => l.id === current)?.section ?? ''
  // Le module en cours est ouvert ; les autres se déplient d'un clic.
  const [open, setOpen] = useState(() => new Set([currentSection]))
  const currentRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => { currentRef.current?.scrollIntoView({ block: 'center' }) }, [current])
  const toggle = (s: string) => { const n = new Set(open); if (n.has(s)) n.delete(s); else n.add(s); setOpen(n) }

  return (
    <div className="space-y-2">
      {sections.map((s, si) => {
        const items = outline.filter((l) => (l.section ?? '') === s)
        const finished = items.filter((l) => done.has(l.id)).length
        const minutes = Math.round(items.reduce((t, l) => t + (l.duration ?? 0), 0) / 60)
        const isOpen = open.has(s) || !s
        return (
          <div key={s || si} className={clsx('rounded-2xl', s === currentSection && 'bg-gray-50')}>
            {s && (
              <button type="button" onClick={() => toggle(s)} aria-expanded={isOpen} className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-gray-100">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-gray-900">{s}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>{finished}/{items.length} terminée{finished > 1 ? 's' : ''}</span>
                    {minutes > 0 && <span>· {minutes} min de vidéo</span>}
                  </span>
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-gray-200">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${items.length ? (finished / items.length) * 100 : 0}%` }} />
                  </span>
                </span>
                <ChevronDown className={clsx('mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
              </button>
            )}
            {isOpen && (
              <ol className="space-y-0.5 px-1 pb-2">
                {items.map((l) => {
                  const isCurrent = l.id === current
                  return (
                    <li key={l.id}>
                      <Link href={`/cours/${slug}/lecon/${l.id}`} ref={isCurrent ? currentRef : undefined} aria-current={isCurrent ? 'page' : undefined}
                        className={clsx('flex items-start gap-3 rounded-xl px-2 py-2 text-sm', isCurrent ? 'bg-surface font-medium text-gray-900 shadow-[inset_3px_0_0_var(--color-brand)]' : 'text-gray-700 hover:bg-gray-100')}>
                        <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]', done.has(l.id) ? 'bg-brand text-white' : 'border border-gray-300 text-gray-500')}>
                          {!l.unlocked ? <Lock className="h-3 w-3" /> : done.has(l.id) ? <Check className="h-3 w-3" strokeWidth={3} /> : ''}
                        </span>
                        <span className={clsx('min-w-0 flex-1 leading-snug', !l.unlocked && 'text-gray-500')}>{l.title}</span>
                        {l.duration ? <PlayCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="vidéo" /> : <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="lecture" />}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}
