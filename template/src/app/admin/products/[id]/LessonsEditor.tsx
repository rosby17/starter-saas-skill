'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/choice'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/dialog'
import { Field, Notice, api, inputClass, readVideoDuration, uploadToStorage } from '@/components/admin/kit'

export type AdminLesson = { id: string; title: string; section?: string | null; summary?: string | null; description: string | null; youtube_url: string | null; video_path: string | null; duration_seconds: number | null; is_preview: boolean; position: number; released_at?: string }

// Leçon « de base » : date de sortie fixée au 1er janvier 2026 (avant tout achat) → dans la version de TOUS les acheteurs.
// Sinon c'est une nouveauté : réservée aux abonnés pour ceux qui ont acheté avant sa sortie.
const BASE_DATE = '2026-01-01T00:00:00.000Z'
const isBase = (iso?: string) => !!iso && new Date(iso).getTime() <= new Date(BASE_DATE).getTime()

type Draft = { id?: string; title: string; section: string; summary: string; description: string; youtube_url: string; video_path: string | null; duration_seconds: number | null; is_preview: boolean; position: number; released_at?: string; base: boolean }

const toDraft = (l: AdminLesson): Draft => ({ id: l.id, title: l.title, section: l.section ?? '', summary: l.summary ?? '', description: l.description ?? '', youtube_url: l.youtube_url ?? '', video_path: l.video_path, duration_seconds: l.duration_seconds, is_preview: l.is_preview, position: l.position, released_at: l.released_at, base: isBase(l.released_at) })
const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}` : '')

// Leçons d'un produit : vidéo envoyée sur NOTRE serveur (stockage privé) ou lien YouTube.
export function LessonsEditor({ productId, lessons, onChange }: { productId: string; lessons: AdminLesson[]; onChange: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()

  const startNew = (section = lessons.at(-1)?.section ?? '') => setDraft({ title: '', section: section ?? '', summary: '', description: '', youtube_url: '', video_path: null, duration_seconds: null, is_preview: false, position: (lessons.at(-1)?.position ?? 0) + 10, base: false })
  const [newModule, setNewModule] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)

  // Modules dans l'ordre de leurs leçons (« » = sans module).
  const modules = useMemo(() => {
    const out: { name: string; lessons: AdminLesson[] }[] = []
    for (const l of lessons) {
      const name = l.section ?? ''
      const m = out.find((x) => x.name === name)
      if (m) m.lessons.push(l); else out.push({ name, lessons: [l] })
    }
    return out
  }, [lessons])

  const outline = async (body: Record<string, unknown>, ok: string) => {
    const d = await api(`/api/admin/products/${productId}/outline`, 'POST', body)
    setMessage(d.success ? { tone: 'green', text: ok } : { tone: 'red', text: d.message || 'Erreur.' })
    onChange()
    return d.success
  }
  const reorder = (ids: string[]) => outline({ action: 'reorder', ids }, 'Ordre enregistré.')
  const moveModule = (i: number, dir: -1 | 1) => {
    const order = [...modules]
    const j = i + dir
    if (!order[j]) return
    ;[order[i], order[j]] = [order[j], order[i]]
    reorder(order.flatMap((m) => m.lessons.map((l) => l.id)))
  }
  const deleteModule = async (name: string, count: number) => {
    if (!(await confirm({ title: `Supprimer le module « ${name || 'Sans module'} » ?`, message: `Ses ${count} leçon${count > 1 ? 's' : ''} et leurs vidéos seront supprimées du serveur.`, confirmLabel: 'Supprimer le module', danger: true }))) return
    outline({ action: 'delete_module', name }, 'Module supprimé.')
  }

  const pickVideo = async (file: File | undefined) => {
    if (!file || !draft) return
    setMessage(null)
    setProgress(0)
    try {
      const duration = await readVideoDuration(file)
      const path = await uploadToStorage('videos', productId, file, setProgress)
      setDraft((d) => (d ? { ...d, video_path: path, duration_seconds: duration ?? d.duration_seconds, youtube_url: '' } : d))
      setMessage({ tone: 'green', text: 'Vidéo envoyée. Enregistre la leçon pour la publier.' })
    } catch (error) {
      setMessage({ tone: 'red', text: (error as Error).message })
    } finally {
      setProgress(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const save = async () => {
    if (!draft) return
    const { base, ...rest } = draft
    // Base : date fixe d'avant tout achat. Nouveauté : sa date de sortie (aujourd'hui pour une nouvelle leçon, inchangée sinon).
    const released_at = base ? BASE_DATE : !draft.id || isBase(draft.released_at) ? new Date().toISOString() : draft.released_at
    const body = { ...rest, section: draft.section || null, summary: draft.summary || null, released_at, product_id: productId, youtube_url: draft.youtube_url || null }
    const d = await api(draft.id ? `/api/admin/lessons/${draft.id}` : '/api/admin/lessons', draft.id ? 'PATCH' : 'POST', body)
    if (!d.success) return setMessage({ tone: 'red', text: d.message || 'Enregistrement impossible.' })
    setDraft(null)
    setMessage({ tone: 'green', text: 'Leçon enregistrée.' })
    onChange()
  }

  const remove = async (lesson: AdminLesson) => {
    if (!(await confirm({ title: `Supprimer « ${lesson.title} » ?`, message: 'La vidéo est aussi supprimée du serveur.', confirmLabel: 'Supprimer', danger: true }))) return
    const d = await api(`/api/admin/lessons/${lesson.id}`, 'DELETE')
    setMessage(d.success ? { tone: 'green', text: 'Leçon supprimée.' } : { tone: 'red', text: d.message || 'Erreur.' })
    onChange()
  }

  // Déplace une leçon d'un cran dans l'ordre général (elle reste dans son module).
  const move = (lesson: AdminLesson, dir: -1 | 1) => {
    const ids = lessons.map((l) => l.id)
    const i = ids.indexOf(lesson.id)
    const j = i + dir
    if (j < 0 || j >= ids.length || (lessons[j].section ?? '') !== (lesson.section ?? '')) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder(ids)
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl">Leçons</h2>
        <span className="text-sm text-gray-500">Vidéos protégées : visibles seulement par les acheteurs, lien de lecture temporaire, filigrane avec leur e-mail.</span>
        {!draft && <Button onClick={() => startNew()} className="ml-auto rounded-full">Ajouter une leçon</Button>}
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {modules.map((m, mi) => {
        const start = lessons.findIndex((l) => l.id === m.lessons[0].id)
        return (
          <div key={m.name || '_'} className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-center gap-2 bg-gray-100 px-3 py-2.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Module {mi + 1}</span>
              {renaming?.from === m.name ? (
                <>
                  <input autoFocus className={`${inputClass} h-9 max-w-xs py-1`} value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && renaming.to.trim()) { outline({ action: 'rename_module', from: m.name, to: renaming.to }, 'Module renommé.'); setRenaming(null) } }} />
                  <button type="button" className="text-brand underline" disabled={!renaming.to.trim()} onClick={() => { outline({ action: 'rename_module', from: m.name, to: renaming.to }, 'Module renommé.'); setRenaming(null) }}>OK</button>
                  <button type="button" className="text-gray-500 underline" onClick={() => setRenaming(null)}>Annuler</button>
                </>
              ) : (
                <span className="font-medium">{m.name || 'Sans module'}</span>
              )}
              <span className="text-xs text-gray-500">{m.lessons.length} leçon{m.lessons.length > 1 ? 's' : ''}</span>
              <span className="ml-auto flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => moveModule(mi, -1)} disabled={mi === 0} className="rounded-lg px-2 py-1 hover:bg-gray-200 disabled:opacity-30" aria-label="Monter le module">↑</button>
                <button type="button" onClick={() => moveModule(mi, 1)} disabled={mi === modules.length - 1} className="rounded-lg px-2 py-1 hover:bg-gray-200 disabled:opacity-30" aria-label="Descendre le module">↓</button>
                <button type="button" onClick={() => setRenaming({ from: m.name, to: m.name })} className="px-1 text-brand underline">Renommer</button>
                <button type="button" onClick={() => startNew(m.name)} className="px-1 text-brand underline">+ Leçon</button>
                <button type="button" onClick={() => deleteModule(m.name, m.lessons.length)} className="px-1 text-red-700 underline">Supprimer</button>
              </span>
            </div>
            <ol className="divide-y divide-gray-200">
              {m.lessons.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="w-6 text-gray-500 tabular-nums">{start + i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l.title}</span>
                    <span className="text-xs text-gray-500">{l.video_path ? `Vidéo sur le serveur ${fmt(l.duration_seconds)}` : l.youtube_url ? 'Lien YouTube' : 'Leçon écrite'}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${isBase(l.released_at) ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-700'}`}>
                      {isBase(l.released_at) ? 'Version de base' : `Nouveauté du ${l.released_at ? new Date(l.released_at).toLocaleDateString('fr-FR') : '—'} · abonnés`}
                    </span>
                  </span>
                  <button type="button" onClick={() => move(l, -1)} disabled={i === 0} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30" aria-label="Monter">↑</button>
                  <button type="button" onClick={() => move(l, 1)} disabled={i === m.lessons.length - 1} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30" aria-label="Descendre">↓</button>
                  <button type="button" onClick={() => setDraft(toDraft(l))} className="text-brand underline">Modifier</button>
                  <button type="button" onClick={() => remove(l)} className="text-red-700 underline">Supprimer</button>
                </li>
              ))}
            </ol>
          </div>
        )
      })}

      {!draft && (newModule === null ? (
        <button type="button" onClick={() => setNewModule('')} className="w-full rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:border-brand hover:text-brand">+ Nouveau module</button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 p-3">
          <input autoFocus className={`${inputClass} max-w-sm`} placeholder="Titre du module, ex. Module 4 · Publier" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
          <Button disabled={!newModule.trim()} onClick={() => { startNew(newModule.trim()); setNewModule(null) }} className="rounded-full">Créer et ajouter sa 1re leçon</Button>
          <Button variant="ghost" onClick={() => setNewModule(null)} className="rounded-full">Annuler</Button>
        </div>
      ))}

      {draft && (
        <div className="space-y-4 rounded-xl border border-gray-300 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titre de la leçon"><input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Module">
              <Select value={draft.section} onChange={(v) => setDraft({ ...draft, section: v })}
                options={[...new Set([...modules.map((m) => m.name), draft.section])].map((n) => ({ value: n, label: n || 'Sans module' }))} />
            </Field>
          </div>
          <Field label="Résumé (ce que l’élève va faire)" hint="Une ou deux phrases, affichées sur la carte de la leçon."><textarea className={inputClass} rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></Field>
          <Field label="Description (facultatif)"><textarea className={inputClass} rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <span className="text-gray-600">Vidéo sur ton serveur (recommandé)</span>
              <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => pickVideo(e.target.files?.[0])} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" disabled={progress !== null} onClick={() => fileInput.current?.click()}>
                  {draft.video_path ? 'Remplacer la vidéo' : 'Choisir une vidéo'}
                </Button>
                {draft.video_path && <span className="text-xs text-green-700">✓ {draft.video_path.split('/').pop()} {fmt(draft.duration_seconds)}</span>}
              </div>
              {progress !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
              )}
              {progress !== null && <span className="text-xs text-gray-500">Envoi… {progress} % (garde cette page ouverte)</span>}
            </div>
            <Field label="Ou lien YouTube (non répertorié)" hint="Plus simple mais partageable : préfère la vidéo sur ton serveur.">
              <input className={inputClass} value={draft.youtube_url} disabled={!!draft.video_path} onChange={(e) => setDraft({ ...draft, youtube_url: e.target.value })} placeholder="https://youtu.be/…" />
            </Field>
          </div>
          <div className="space-y-1 text-sm">
            <Switch checked={draft.base} onChange={(v) => setDraft({ ...draft, base: v })} label={draft.base ? 'Dans la version de base : tous les acheteurs, même sans abonnement' : 'Nouveauté : réservée aux abonnés'} />
            <p className="text-gray-500">Nouveauté = les clients qui ont acheté avant sa sortie la voient avec l’abonnement ; les nouveaux acheteurs l’ont dans leur version.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={save} disabled={progress !== null || !draft.title.trim()} className="rounded-full px-6">Enregistrer la leçon</Button>
            <Button variant="ghost" onClick={() => setDraft(null)} className="rounded-full">Annuler</Button>
          </div>
        </div>
      )}
    </section>
  )
}
