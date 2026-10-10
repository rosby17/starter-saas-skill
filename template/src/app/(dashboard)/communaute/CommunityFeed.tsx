'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CalendarDays, FileText, Image as ImageIcon, Mic, Pin, Plus, Send, Smile, Square, Trash2, X } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useConfirm } from '@/components/ui/dialog'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/choice'
import { AudioPlayer } from '@/components/course/AudioPlayer'
import Link from 'next/link'
import { ArrowLeft, Megaphone, MessagesSquare } from 'lucide-react'
import type { Channel, FeedPost, Media } from '@/lib/community/feed'
import { TZ_ISO, TZ_LABEL } from '@/lib/time'

// Un groupe de la communauté, façon WhatsApp. « Annonces » : l'administrateur publie, les membres lisent,
// réagissent et votent. « Discussion » : tout le monde écrit (mes messages à droite, ceux des autres à gauche).

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥']
const EMOJIS: Record<string, string[]> = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😎', '🤓', '🧐', '🤔', '🤫', '🤗', '🤭', '😏', '😌', '😴', '🥳', '🤯', '😱', '😢', '😭', '😤', '😡', '🙄', '😬', '🫡', '🫶'],
  'Gestes': ['👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '👌', '✌️', '🤞', '🤙', '👋', '☝️', '👉', '👇', '✍️', '🫵'],
  'Cœurs': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '💥', '✨', '⭐', '🔥', '⚡', '🎉', '🎊', '🏆', '🥇'],
  'Travail': ['💻', '📱', '🖥️', '⌨️', '🎬', '🎥', '🎙️', '🎧', '📸', '📈', '📊', '💰', '💸', '🧠', '🤖', '🚀', '🛠️', '📌', '📣', '🔔', '✅', '❌', '⚠️', '⏰', '📅', '🎁'],
}

const DAY = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const HOUR = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayKey = (iso: string) => new Date(iso).toDateString()

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return res.json().catch(() => ({ success: false }))
}

/** Envoie un fichier dans le stockage privé de la communauté (lien signé), avec la progression. */
async function upload(file: File | Blob, name: string, onProgress: (p: number) => void): Promise<Media> {
  const type = file.type || 'application/octet-stream'
  const signed = await api('/api/community/upload-url', 'POST', { filename: name, type, size: file.size })
  if (!signed.success) throw new Error(signed.message || 'Envoi impossible.')
  const url = signed.signedUrl.startsWith('http') ? signed.signedUrl : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${signed.signedUrl}`
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Envoi refusé (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'))
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', file, name)
    xhr.send(form)
  })
  return { path: signed.path, type: signed.kind, name }
}

/** Texte avec liens cliquables (jamais de HTML injecté). */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return <>{parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">{p}</a> : <Fragment key={i}>{p}</Fragment>)}</>
}

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(Object.keys(EMOJIS)[0])
  return (
    <div className="absolute bottom-14 right-0 z-20 w-80 rounded-2xl border border-gray-200 bg-surface p-3 shadow-2xl">
      <div className="mb-2 flex items-center gap-1">
        {Object.keys(EMOJIS).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={clsx('rounded-full px-3 py-1 text-xs', tab === k ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100')}>{k}</button>
        ))}
        <button type="button" onClick={onClose} className="ml-auto rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Fermer"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
        {EMOJIS[tab].map((e) => <button key={e} type="button" onClick={() => onPick(e)} className="rounded-lg p-1 text-xl hover:bg-gray-100">{e}</button>)}
      </div>
    </div>
  )
}

const NAME_COLORS = ['text-brand', 'text-sky-600', 'text-emerald-600', 'text-amber-600', 'text-violet-600', 'text-pink-600']
const nameColor = (id: string) => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length]

function Bubble({ p, isAdmin, discussion, onChange }: { p: FeedPost; isAdmin: boolean; discussion: boolean; onChange: () => void }) {
  const confirm = useConfirm()
  const [mine, setMine] = useState(p.mine)
  const [reactions, setReactions] = useState(p.reactions)
  const [bar, setBar] = useState(false)
  const [votes, setVotes] = useState(p.poll?.my ?? [])

  const react = async (emoji: string) => {
    const next = mine === emoji ? null : emoji
    const prev = mine
    setBar(false); setMine(next)
    setReactions((rs) => {
      const m = new Map(rs.map((r) => [r.emoji, r.count]))
      if (prev) m.set(prev, (m.get(prev) ?? 1) - 1)
      if (next) m.set(next, (m.get(next) ?? 0) + 1)
      return [...m].filter(([, c]) => c > 0).map(([e, c]) => ({ emoji: e, count: c })).sort((a, b) => b.count - a.count)
    })
    await api('/api/community/reactions', 'POST', { postId: p.id, emoji: next })
  }
  const vote = async (i: number) => {
    const multiple = !!p.meta.multiple
    const next = votes.includes(i) ? votes.filter((x) => x !== i) : multiple ? [...votes, i] : [i]
    setVotes(next)
    await api('/api/community/votes', 'POST', { postId: p.id, options: next })
    onChange()
  }
  const remove = async () => {
    if (await confirm({ title: 'Supprimer ce message ?', message: 'Il disparaît pour tous les membres, avec ses fichiers.', confirmLabel: 'Supprimer', danger: true })) {
      if ((await api(`/api/community/posts/${p.id}`, 'DELETE')).success) onChange()
    }
  }
  const pin = async () => { if ((await api(`/api/community/posts/${p.id}`, 'PATCH', { pinned: !p.pinned })).success) onChange() }
  const visuals = p.media.filter((m) => m.type === 'image' || m.type === 'video')
  const right = discussion && p.isMe
  const canDelete = isAdmin || p.isMe
  const total = p.poll ? Math.max(1, p.poll.counts.reduce((a, b) => a + b, 0)) : 1

  const BADGE: Record<string, string> = { admin: 'bg-gray-900 text-white', pro: 'bg-brand text-white', eleve: 'border border-green-200 bg-green-50 text-green-800' }
  const LABEL: Record<string, string> = { admin: 'Fondateur', pro: 'PRO', eleve: 'Élève' }
  const avatar = (
    <span className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
      {p.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        : <span className={clsx('grid h-full w-full place-items-center text-xs font-semibold', p.authorIsAdmin ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700')}>{p.author.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
    </span>
  )

  return (
    <div className={clsx('flex items-start gap-2', right && 'justify-end')}>
    {!right && avatar}
    <div className={clsx('group relative min-w-0 max-w-[88%] sm:max-w-[74%]')} onMouseLeave={() => setBar(false)}>
      <div className={clsx('overflow-hidden rounded-2xl border text-[15px] text-gray-900 shadow-sm', right ? 'rounded-tr-md border-brand/20 bg-brand/10' : 'rounded-tl-md border-gray-200 bg-surface')}>
        <div className={clsx('flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-2', right && !p.pinned && 'hidden')}>
          <p className={clsx('text-sm font-medium', p.authorIsAdmin ? 'text-brand' : nameColor(p.authorId))}>{p.isMe ? 'Vous' : p.author}</p>
          {p.username && <p className="text-xs text-gray-500">~@{p.username}</p>}
          {BADGE[p.status] && <span className={clsx('rounded-full px-1.5 py-px text-[10px] font-semibold', BADGE[p.status])}>{LABEL[p.status]}</span>}
          {p.pinned && <Pin className="ml-auto h-3.5 w-3.5 text-gray-500" aria-label="Épinglé" />}
        </div>
        {visuals.length > 0 && (
          <div className={clsx('mt-2 grid gap-0.5 px-1', visuals.length > 1 && 'grid-cols-2')}>
            {visuals.map((m) => m.url && (m.type === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <a key={m.path} href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt="" className="max-h-[420px] w-full rounded-xl object-cover" /></a>
              : <video key={m.path} src={m.url} controls playsInline preload="metadata" controlsList="nodownload" className="w-full rounded-xl bg-black" />))}
          </div>
        )}
        <div className="space-y-2 px-3 pb-1.5 pt-1.5">
          {p.media.filter((m) => m.type === 'audio').map((m) => m.url && <div key={m.path} className="rounded-xl bg-gray-100 p-1"><AudioPlayer src={m.url} /></div>)}
          {p.media.filter((m) => m.type === 'file').map((m) => m.url && (
            <a key={m.path} href={m.url} className="flex items-center gap-3 rounded-xl bg-gray-100 px-3 py-2.5 hover:bg-gray-200">
              <FileText className="h-6 w-6 shrink-0 text-brand" /><span className="truncate text-sm">{m.name}</span>
            </a>
          ))}
          {p.kind === 'event' && (
            <div className="rounded-xl bg-gray-100 p-3">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><CalendarDays className="h-4 w-4 text-brand" /> Événement</p>
              <p className="mt-1 text-base font-medium">{p.meta.title}</p>
              {p.meta.starts_at && <p className="text-sm text-gray-700">{new Date(p.meta.starts_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>}
              {p.meta.place && <p className="text-sm text-gray-500">{p.meta.place}</p>}
              {p.meta.link && <a href={p.meta.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white">Rejoindre</a>}
            </div>
          )}
          {p.kind === 'poll' && p.poll && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-medium"><BarChart3 className="h-4 w-4 text-brand" />{p.meta.question}</p>
              <p className="text-xs text-gray-500">{p.meta.multiple ? 'Plusieurs choix possibles' : 'Un seul choix'}</p>
              {(p.meta.options ?? []).map((o, i) => {
                const n = p.poll!.counts[i] ?? 0
                return (
                  <button key={i} type="button" onClick={() => vote(i)} className="block w-full text-left">
                    <span className="flex items-center gap-2 text-sm">
                      <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', votes.includes(i) ? 'border-brand bg-brand' : 'border-gray-400')}>{votes.includes(i) && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                      <span className="flex-1">{o}</span><span className="text-xs text-gray-500">{n}</span>
                    </span>
                    <span className="ml-7 mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-200"><span className="block h-full rounded-full bg-brand" style={{ width: `${(n / total) * 100}%` }} /></span>
                  </button>
                )
              })}
              <p className="text-xs text-gray-500">{p.poll.voters} vote{p.poll.voters > 1 ? 's' : ''}</p>
            </div>
          )}
          {p.body && <p className="whitespace-pre-line break-words leading-relaxed"><Rich text={p.body} /></p>}
          <p className="text-right text-[11px] text-gray-500">{HOUR(p.created_at)} {p.isMe && <span className="text-sky-500">✓✓</span>}</p>
        </div>
      </div>
      {reactions.length > 0 && (
        <div className="-mt-2 ml-3 flex w-fit gap-1 rounded-full border border-gray-200 bg-surface px-2 py-0.5 text-sm shadow">
          {reactions.slice(0, 4).map((r) => <span key={r.emoji}>{r.emoji}</span>)}
          <span className="text-xs text-gray-500">{reactions.reduce((a, r) => a + r.count, 0)}</span>
        </div>
      )}
      <div className={clsx('absolute top-1 flex flex-col gap-1 transition-opacity', right ? '-left-2 -translate-x-full' : '-right-2 translate-x-full', bar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        <button type="button" onClick={() => setBar(!bar)} className="rounded-full border border-gray-200 bg-surface p-1.5 text-gray-500 hover:text-gray-900" aria-label="Réagir"><Smile className="h-4 w-4" /></button>
        {isAdmin && <button type="button" onClick={pin} className="rounded-full border border-gray-200 bg-surface p-1.5 text-gray-500 hover:text-gray-900" aria-label={p.pinned ? 'Désépingler' : 'Épingler'}><Pin className="h-4 w-4" /></button>}
        {canDelete && <button type="button" onClick={remove} className="rounded-full border border-gray-200 bg-surface p-1.5 text-gray-500 hover:text-red-600" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>}
      </div>
      {bar && (
        <div className="absolute -top-11 left-2 z-10 flex gap-1 rounded-full border border-gray-200 bg-surface px-2 py-1 shadow-xl">
          {QUICK.map((e) => <button key={e} type="button" onClick={() => react(e)} className={clsx('rounded-full px-1 text-xl transition-transform hover:scale-125', mine === e && 'bg-gray-200')}>{e}</button>)}
        </div>
      )}
    </div>
    </div>
  )
}

function PollModal({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (poll: { question: string; options: string[]; multiple: boolean }) => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const ok = question.trim() && options.filter((o) => o.trim()).length >= 2
  const field = 'w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 outline-none focus:border-brand'
  return (
    <Modal open={open} onClose={onClose} title="Créer un sondage"
      footer={<button type="button" disabled={!ok} onClick={() => { onSend({ question: question.trim(), options: options.map((o) => o.trim()).filter(Boolean), multiple }); setQuestion(''); setOptions(['', '']); setMultiple(false) }} className="rounded-full bg-brand px-6 py-2.5 font-medium text-white disabled:opacity-50">Envoyer</button>}>
      <div className="space-y-3">
        <input className={field} placeholder="Pose une question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} />
        {options.map((o, i) => (
          <input key={i} className={field} placeholder={`Réponse ${i + 1}`} value={o} maxLength={100}
            onChange={(e) => { const n = [...options]; n[i] = e.target.value; if (i === n.length - 1 && e.target.value && n.length < 12) n.push(''); setOptions(n) }} />
        ))}
        <Checkbox checked={multiple} onChange={setMultiple} label="Autoriser plusieurs réponses" />
      </div>
    </Modal>
  )
}

function EventModal({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (e: { title: string; starts_at: string; place?: string; link?: string }) => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('20')
  const [minute, setMinute] = useState('00')
  const [place, setPlace] = useState('')
  const [link, setLink] = useState('')
  const field = 'w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 outline-none focus:border-brand'
  const ok = title.trim() && date
  return (
    <Modal open={open} onClose={onClose} title="Créer un événement" subtitle="Live, atelier, sortie d’une formation…"
      footer={<button type="button" disabled={!ok} onClick={() => { onSend({ title: title.trim(), starts_at: new Date(`${date}T${hour}:${minute}:00${TZ_ISO}`).toISOString(), place: place.trim() || undefined, link: link.trim() || undefined }); setTitle(''); setDate(''); setPlace(''); setLink('') }} className="rounded-full bg-brand px-6 py-2.5 font-medium text-white disabled:opacity-50">Envoyer</button>}>
      <div className="space-y-3">
        <input className={field} placeholder="Nom de l’événement" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <div className="grid grid-cols-[1fr_90px_90px] gap-2">
          <DatePicker value={date} onChange={setDate} placeholder="Date" />
          <Select value={hour} onChange={setHour} options={Array.from({ length: 24 }, (_, h) => ({ value: String(h).padStart(2, '0'), label: `${h} h` }))} />
          <Select value={minute} onChange={setMinute} options={['00', '15', '30', '45'].map((m) => ({ value: m, label: m }))} />
        </div>
        <p className="text-xs text-gray-500">{TZ_LABEL}.</p>
        <input className={field} placeholder="Lieu (facultatif), ex. Live YouTube" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} />
        <input className={field} placeholder="Lien (facultatif) : https://…" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} />
      </div>
    </Modal>
  )
}

/** Barre d'envoi (admin) : « + » (fichier, photos et vidéos, sondage, événement), texte, emojis, vocal. */
function Composer({ channel, isAdmin, onDone }: { channel: string; isAdmin: boolean; onDone: () => void }) {
  const [text, setText] = useState('')
  const [media, setMedia] = useState<Media[]>([])
  const [menu, setMenu] = useState(false)
  const [emoji, setEmoji] = useState(false)
  const [modal, setModal] = useState<'poll' | 'event' | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rec, setRec] = useState<{ start: number; recorder: MediaRecorder; chunks: Blob[] } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const files = useRef<HTMLInputElement>(null)
  const visuals = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - rec.start) / 1000)), 250)
    return () => clearInterval(t)
  }, [rec])

  const publish = async (body: Record<string, unknown>) => {
    setError(null)
    const d = await api('/api/community/posts', 'POST', { channel, ...body })
    if (!d.success) { setError(d.message || 'Envoi impossible.'); return false }
    onDone()
    return true
  }
  const pick = async (list: FileList | null) => {
    setMenu(false)
    if (!list) return
    for (const f of Array.from(list).slice(0, 10 - media.length)) {
      try { setProgress(0); const m = await upload(f, f.name, setProgress); setMedia((x) => [...x, m]) } catch (e) { setError((e as Error).message) }
    }
    setProgress(null)
  }
  const send = async () => {
    if (!text.trim() && !media.length) return
    if (await publish({ body: text, media })) { setText(''); setMedia([]) }
  }
  const startVoice = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.start()
      setElapsed(0)
      setRec({ start: Date.now(), recorder, chunks })
    } catch {
      setError('Micro inaccessible : autorise le micro pour ce site dans ton navigateur.')
    }
  }
  const stopVoice = async (keep: boolean) => {
    if (!rec) return
    const { recorder, chunks, start } = rec
    const done = new Promise<void>((r) => { recorder.onstop = () => r() })
    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())
    await done
    setRec(null)
    if (!keep) return
    const blob = new Blob(chunks, { type: recorder.mimeType })
    const ext = recorder.mimeType.includes('mp4') ? 'm4a' : 'webm'
    try {
      setProgress(0)
      const m = await upload(blob, `vocal-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`, setProgress)
      await publish({ body: '', media: [{ ...m, type: 'audio', duration: Math.round((Date.now() - start) / 1000) }] })
    } catch (e) { setError((e as Error).message) }
    setProgress(null)
  }

  const empty = !text.trim() && !media.length
  return (
    <div className="relative border-t border-gray-200 bg-surface px-3 py-2.5">
      <input ref={files} type="file" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      <input ref={visuals} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {progress !== null && <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>}
      {media.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2 text-xs text-gray-700">
          {media.map((m) => (
            <li key={m.path} className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
              {m.type === 'image' ? 'Photo' : m.type === 'video' ? 'Vidéo' : m.type === 'audio' ? 'Audio' : 'Fichier'} · <span className="max-w-[160px] truncate">{m.name}</span>
              <button type="button" onClick={() => setMedia((x) => x.filter((y) => y.path !== m.path))} aria-label="Retirer"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {menu && (
        <div className="absolute bottom-16 left-3 z-20 grid grid-flow-col gap-3 rounded-3xl border border-gray-200 bg-surface p-4 shadow-2xl">
          {[
            { label: 'Fichier', icon: FileText, color: 'bg-brand', on: () => files.current?.click() },
            { label: 'Photos et vidéos', icon: ImageIcon, color: 'bg-brand', on: () => visuals.current?.click() },
            ...(isAdmin ? [
              { label: 'Sondage', icon: BarChart3, color: 'bg-brand', on: () => { setMenu(false); setModal('poll') } },
              { label: 'Événement', icon: CalendarDays, color: 'bg-brand', on: () => { setMenu(false); setModal('event') } },
            ] : []),
          ].map((a) => (
            <button key={a.label} type="button" onClick={a.on} className="flex w-20 flex-col items-center gap-2 text-center text-xs text-gray-900">
              <span className={clsx('grid h-14 w-14 place-items-center rounded-full text-white', a.color)}><a.icon className="h-6 w-6" /></span>{a.label}
            </button>
          ))}
        </div>
      )}
      {emoji && <EmojiPicker onPick={(e) => { setText((t) => t + e); area.current?.focus() }} onClose={() => setEmoji(false)} />}
      {rec ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => stopVoice(false)} className="rounded-full p-2 text-gray-500 hover:text-red-600" aria-label="Annuler le vocal"><Trash2 className="h-5 w-5" /></button>
          <span className="flex items-center gap-2 text-gray-900"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          <span className="flex-1 text-sm text-gray-500">Enregistrement…</span>
          <button type="button" onClick={() => stopVoice(true)} className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white" aria-label="Envoyer le vocal"><Square className="h-4 w-4" fill="currentColor" /></button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => { setMenu(!menu); setEmoji(false) }} className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-500 transition-transform hover:text-gray-900', menu && 'rotate-45')} aria-label="Joindre"><Plus className="h-6 w-6" /></button>
          <div className="flex min-w-0 flex-1 items-end rounded-3xl bg-gray-100 px-4">
            <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={8000} placeholder={isAdmin ? 'Écris un message' : 'Écris ton message'}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-500" />
            <button type="button" onClick={() => { setEmoji(!emoji); setMenu(false) }} className="py-3 pl-2 text-gray-500 hover:text-gray-900" aria-label="Emojis"><Smile className="h-6 w-6" /></button>
          </div>
          {empty ? (
            <button type="button" onClick={startVoice} disabled={progress !== null} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-50" aria-label="Enregistrer un vocal"><Mic className="h-5 w-5" /></button>
          ) : (
            <button type="button" onClick={send} disabled={progress !== null} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-50" aria-label="Envoyer"><Send className="h-5 w-5" /></button>
          )}
        </div>
      )}
      <PollModal open={modal === 'poll'} onClose={() => setModal(null)} onSend={async (poll) => { if (await publish({ kind: 'poll', poll })) setModal(null) }} />
      <EventModal open={modal === 'event'} onClose={() => setModal(null)} onSend={async (event) => { if (await publish({ kind: 'event', event })) setModal(null) }} />
    </div>
  )
}

export function CommunityFeed({ channel, initial: latest, isAdmin, members }: { channel: Channel; initial: FeedPost[]; isAdmin: boolean; members: number }) {
  const router = useRouter()
  // Historique complet : les messages plus anciens se chargent à la demande, en haut du fil.
  const [older, setOlder] = useState<FeedPost[]>([])
  const [more, setMore] = useState(latest.length >= 60)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const initial = [...older.filter((o) => !latest.some((l) => l.id === o.id)), ...latest]
  const loadOlder = async () => {
    if (!initial.length) return
    setLoadingOlder(true)
    const el = scroller.current, h = el?.scrollHeight ?? 0
    const d = await fetch(`/api/community/posts?channel=${channel.slug}&before=${encodeURIComponent(initial[0].created_at)}`).then((r) => r.json()).catch(() => ({ success: false }))
    setLoadingOlder(false)
    if (!d.success) return
    setOlder((o) => [...(d.posts as FeedPost[]), ...o])
    setMore(!!d.more)
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - h })
  }
  const scroller = useRef<HTMLDivElement>(null)
  const refresh = () => router.refresh()
  const discussion = channel.mode === 'discussion'
  const canWrite = isAdmin || discussion
  const pinned = [...initial].reverse().find((p) => p.pinned)
  // Ouvre sur le dernier message, comme une conversation ; nouveaux messages des autres : toutes les 20 s.
  // Lien vers un message précis (#msg-…, ex. « Discuter avec l'élève » depuis un avis) : on s'y place, sinon en bas.
  useEffect(() => {
    const el = scroller.current
    const target = window.location.hash.startsWith('#msg-') ? document.getElementById(window.location.hash.slice(1)) : null
    if (target) target.scrollIntoView({ block: 'center' })
    else if (el) el.scrollTop = el.scrollHeight
  }, [latest.length])
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 20_000); return () => clearInterval(t) }, [router])

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-100">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-surface px-4 py-3">
        <Link href="/communaute" className="rounded-full p-1 text-gray-500 hover:text-gray-900 md:hidden" aria-label="Retour aux groupes"><ArrowLeft className="h-5 w-5" /></Link>
        <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', discussion ? 'bg-gray-100 text-brand' : 'bg-brand text-white')}>
          {discussion ? <MessagesSquare className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{channel.name}</p>
          <p className="truncate text-xs text-gray-500">{members > 0 ? `${members} membre${members > 1 ? 's' : ''} · ` : ''}{channel.description}</p>
        </div>
      </header>
      {pinned && (
        <a href={`#msg-${pinned.id}`} className="flex items-center gap-2 border-b border-gray-200 bg-surface px-4 py-2 text-sm text-gray-700">
          <Pin className="h-4 w-4 shrink-0 text-brand" /><span className="truncate">{pinned.body || pinned.meta.question || pinned.meta.title || 'Message épinglé'}</span>
        </a>
      )}
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-8"
        style={{ backgroundImage: 'radial-gradient(rgba(128,128,128,0.14) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        {more && (
          <button type="button" onClick={loadOlder} disabled={loadingOlder} className="mx-auto block rounded-full border border-gray-200 bg-surface px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900">{loadingOlder ? 'Chargement…' : 'Voir les messages précédents'}</button>
        )}
        {initial.length === 0 && <p className="mx-auto mt-10 w-fit rounded-xl border border-gray-200 bg-surface px-4 py-2 text-center text-sm text-gray-500">{canWrite ? 'Écris le premier message du groupe.' : 'Les premières annonces arrivent bientôt.'}</p>}
        {initial.map((p, i) => (
          <Fragment key={p.id}>
            {(i === 0 || dayKey(initial[i - 1].created_at) !== dayKey(p.created_at)) && (
              <p className="mx-auto w-fit rounded-lg border border-gray-200 bg-surface px-3 py-1 text-xs capitalize text-gray-500">{DAY(p.created_at)}</p>
            )}
            <div id={`msg-${p.id}`} className="scroll-mt-20"><Bubble p={p} isAdmin={isAdmin} discussion={discussion} onChange={refresh} /></div>
          </Fragment>
        ))}
      </div>
      {canWrite ? <Composer channel={channel.slug} isAdmin={isAdmin} onDone={refresh} /> : (
        <p className="border-t border-gray-200 bg-surface px-4 py-3 text-center text-sm text-gray-500">Seul l’administrateur peut envoyer des messages ici. Réagis avec un emoji 😊</p>
      )}
    </div>
  )
}
