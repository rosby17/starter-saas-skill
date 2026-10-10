'use client'

import { Fragment, useState } from 'react'
import { clsx } from '@/lib/utils'
import { isYoutube, type Block, type MediaItem, type Ratio } from '@/lib/course/blocks'
import { SecureVideo } from './SecureVideo'
import { Lightbulb, TriangleAlert, ArrowUpRight } from 'lucide-react'
import { BrandIcon } from './BrandIcon'
import { AudioPlayer } from './AudioPlayer'

type Ctx = { urls: Record<string, string>; email: string; onExpired: () => void; zoom: (src: string, caption?: string) => void }

/** **gras** dans un texte de leçon. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    : <Fragment key={i}>{part}</Fragment>)}</>
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1800) }}
      className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:border-brand hover:text-gray-900">
      {done ? '✓ Copié' : 'Copier'}
    </button>
  )
}

function Video({ item, ctx }: { item: { src: string; ratio?: Ratio }; ctx: Ctx }) {
  return isYoutube(item.src)
    ? <SecureVideo youtube={item.src} email={ctx.email} ratio={item.ratio} />
    : <SecureVideo src={ctx.urls[item.src]} email={ctx.email} ratio={item.ratio} onExpired={ctx.onExpired} />
}

function Caption({ label, note }: { label?: string; note?: string }) {
  if (!label && !note) return null
  return (
    <p className="mt-2 text-[15px] text-gray-600">
      {label && <span className="font-medium text-gray-900">{label}</span>}
      {label && note ? ' · ' : ''}{note}
    </p>
  )
}

/** Plusieurs vidéos : les verticales côte à côte, les horizontales l'une sous l'autre sur mobile. */
function VideoGrid({ items, ctx }: { items: MediaItem[]; ctx: Ctx }) {
  const tall = items.every((i) => i.ratio && i.ratio !== '16/9')
  return (
    <div className={clsx('grid gap-4', tall ? (items.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2') : 'sm:grid-cols-2')}>
      {items.map((it) => (
        <figure key={it.src}>
          <Video item={it} ctx={ctx} />
          <Caption label={it.label} note={it.note} />
        </figure>
      ))}
    </div>
  )
}

function Img({ src, caption, ctx, className }: { src: string; caption?: string; ctx: Ctx; className?: string }) {
  const url = ctx.urls[src]
  return url ? (
    <button type="button" onClick={() => ctx.zoom(url, caption)} className={clsx('block w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100', className)} aria-label={caption ? `Agrandir : ${caption}` : 'Agrandir l’image'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- lien signé du stockage privé */}
      <img src={url} alt={caption ?? ''} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]" loading="lazy" />
    </button>
  ) : <div className={clsx('aspect-video w-full animate-pulse rounded-2xl bg-gray-100', className)} />
}

function Quiz({ block }: { block: Extract<Block, { t: 'quiz' }> }) {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <div className="rounded-2xl border border-gray-200 bg-surface p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-brand">Vérifie ce que tu as retenu</p>
      <p className="mt-2 text-xl font-medium">{block.q}</p>
      <div className="mt-4 grid gap-2" role="radiogroup">
        {block.options.map((o, i) => {
          const chosen = pick === i
          const right = pick !== null && i === block.answer
          return (
            <button key={o} type="button" role="radio" aria-checked={chosen} disabled={pick !== null} onClick={() => setPick(i)}
              className={clsx('flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-[16px] transition-colors',
                right ? 'border-green-200 bg-green-50 text-green-800'
                  : chosen ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-gray-200 hover:border-gray-300 disabled:hover:border-gray-200')}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs">{right ? '✓' : chosen ? '✕' : String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          )
        })}
      </div>
      {pick !== null && (
        <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700">
          <span className="font-medium text-gray-900">{pick === block.answer ? 'Bravo. ' : 'Pas tout à fait. '}</span><Rich text={block.explain} />
          {pick !== block.answer && <button type="button" onClick={() => setPick(null)} className="ml-2 text-brand underline">Réessayer</button>}
        </div>
      )}
    </div>
  )
}

function Todo({ block }: { block: Extract<Block, { t: 'todo' }> }) {
  const [done, setDone] = useState<Set<number>>(new Set())
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-brand">{block.title ?? 'À toi de jouer'}</p>
      <ul className="mt-3 space-y-2">
        {block.items.map((it, i) => (
          <li key={i}>
            <button type="button" role="checkbox" aria-checked={done.has(i)} onClick={() => setDone((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n })}
              className="flex w-full items-start gap-3 text-left text-[17px] leading-7">
              <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 text-[11px] text-white', done.has(i) ? 'border-brand bg-brand' : 'border-gray-300')}>{done.has(i) ? '✓' : ''}</span>
              <span className={clsx(done.has(i) && 'text-gray-500 line-through')}><Rich text={it} /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function One({ b, ctx, n }: { b: Block; ctx: Ctx; n: number }) {
  switch (b.t) {
    case 'step':
      return (
        <h2 className="flex items-center gap-3 pt-8 text-[28px] leading-tight">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-base font-medium text-white">{n}</span>
          {b.title}
        </h2>
      )
    case 'p':
      return <p className="whitespace-pre-line text-[18px] leading-8 text-gray-700"><Rich text={b.text} /></p>
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return (
        <Tag className="space-y-2">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[18px] leading-8 text-gray-700">
              <span className={clsx('shrink-0', b.ordered ? 'mt-1 grid h-5 w-5 place-items-center rounded-full bg-gray-100 text-xs text-gray-900' : 'text-brand')}>{b.ordered ? i + 1 : '•'}</span>
              <span><Rich text={it} /></span>
            </li>
          ))}
        </Tag>
      )
    }
    case 'video':
      return <figure className={clsx(b.ratio && b.ratio !== '16/9' && 'mx-auto max-w-sm')}><Video item={b} ctx={ctx} /><Caption note={b.caption} /></figure>
    case 'videos':
      return <VideoGrid items={b.items} ctx={ctx} />
    case 'compare':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {[['Avant', b.before], ['Après', b.after]].map(([tag, it]) => {
            const item = it as MediaItem
            return (
              <figure key={tag as string}>
                <span className={clsx('mb-2 inline-block rounded-full px-3 py-1 text-xs font-medium', tag === 'Avant' ? 'bg-gray-100 text-gray-600' : 'bg-brand text-white')}>{tag as string}</span>
                {/\.(mp4|webm|mov)$/i.test(item.src) || isYoutube(item.src) ? <Video item={item} ctx={ctx} /> : <Img src={item.src} caption={item.label} ctx={ctx} />}
                <Caption label={item.label} note={item.note} />
              </figure>
            )
          })}
        </div>
      )
    case 'image':
      return <figure><Img src={b.src} caption={b.caption} ctx={ctx} /><Caption note={b.caption} /></figure>
    case 'gallery':
      return (
        <div className={clsx('grid gap-3', b.items.length > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
          {b.items.map((it) => <figure key={it.src}><Img src={it.src} caption={it.label} ctx={ctx} className="aspect-video" /><p className="mt-1.5 text-xs text-gray-500">{it.label}</p></figure>)}
        </div>
      )
    case 'audio':
      return (
        <div className="space-y-3">
          {b.items.map((it, i) => (
            <div key={it.src} className="rounded-2xl border border-gray-200 bg-surface p-5">
              <div className="mb-4 flex items-baseline gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold">{it.label}</p>
                  {it.note && <p className="text-[15px] text-gray-600">{it.note}</p>}
                </div>
              </div>
              <AudioPlayer src={ctx.urls[it.src]} onError={ctx.onExpired} />
            </div>
          ))}
        </div>
      )
    case 'quote':
      return (
        <blockquote className="rounded-2xl border-l-4 border-brand bg-surface px-5 py-4">
          <p className="whitespace-pre-line text-[18px] leading-8 text-gray-900">« {b.text} »</p>
          {b.who && <footer className="mt-2 text-sm text-gray-500">{b.who}</footer>}
        </blockquote>
      )
    case 'prompt':
    case 'code':
      return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5">
            <span className="text-xs uppercase tracking-[0.18em] text-gray-500">{b.title ?? (b.t === 'prompt' ? 'Le prompt à donner à Claude' : 'Commande')}</span>
            <Copy text={b.text} />
          </div>
          <pre className={clsx('overflow-x-auto whitespace-pre-wrap px-5 py-4 text-[15px] leading-7', b.t === 'code' ? 'font-mono text-gray-700' : 'text-gray-900')}>{b.text}</pre>
        </div>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left text-[16px]">
            <thead className="bg-gray-100 text-gray-900"><tr>{b.head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i} className="border-t border-gray-200">{r.map((c, j) => <td key={j} className="px-4 py-3 align-top text-gray-700"><Rich text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'tip':
      return (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-medium text-green-800"><Lightbulb className="h-5 w-5" strokeWidth={1.8} aria-hidden />{b.title ?? 'À retenir'}</p>
          <p className="mt-1 whitespace-pre-line text-[17px] leading-8 text-gray-700"><Rich text={b.text} /></p>
        </div>
      )
    case 'warn':
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-medium text-amber-800"><TriangleAlert className="h-5 w-5" strokeWidth={1.8} aria-hidden />{b.title ?? 'Piège à éviter'}</p>
          <p className="mt-1 whitespace-pre-line text-[17px] leading-8 text-gray-700"><Rich text={b.text} /></p>
        </div>
      )
    case 'todo':
      return <Todo block={b} />
    case 'quiz':
      return <Quiz block={b} />
    case 'tools':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {b.items.map((tool) => (
            <div key={tool.name} className="flex gap-4 rounded-2xl border border-gray-200 bg-surface p-4">
              <BrandIcon name={tool.logo} label={tool.name} />
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-gray-900">{tool.name}</p>
                <p className="mt-0.5 text-[15px] leading-6 text-gray-600">{tool.role}</p>
                {tool.url && (
                  <a href={tool.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                    {tool.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}<ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )
  }
}

/** Le contenu d'une leçon, étape par étape. Les titres d'étape sont numérotés dans l'ordre. */
export function LessonBlocks({ blocks, urls, email, onExpired }: { blocks: Block[]; urls: Record<string, string>; email: string; onExpired: () => void }) {
  const [zoomed, setZoomed] = useState<{ src: string; caption?: string } | null>(null)
  const ctx: Ctx = { urls, email, onExpired, zoom: (src, caption) => setZoomed({ src, caption }) }
  let step = 0
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => {
        if (b.t === 'step') step++
        return <One key={i} b={b} ctx={ctx} n={step} />
      })}
      {zoomed && (
        <div role="presentation" onClick={() => setZoomed(null)} onKeyDown={(e) => e.key === 'Escape' && setZoomed(null)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-4" tabIndex={-1}>
          <figure className="max-h-full max-w-6xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- lien signé du stockage privé */}
            <img src={zoomed.src} alt={zoomed.caption ?? ''} className="max-h-[85dvh] w-auto rounded-xl" />
            {zoomed.caption && <figcaption className="mt-3 text-center text-sm text-white/80">{zoomed.caption}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  )
}
