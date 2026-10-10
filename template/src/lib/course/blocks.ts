import { z } from 'zod'

// Contenu d'une leçon, étape par étape (colonne lessons.blocks).
// Les médias (src) sont des chemins DANS le dossier du produit du stockage privé « videos » (ex. « m3/finale-16x9.mp4 »),
// ou une adresse YouTube pour les vidéos publiées. Le lecteur demande des liens signés courts pour toute la leçon.

export type Ratio = '16/9' | '9/16' | '4/5' | '1/1'
export type MediaItem = { src: string; label: string; note?: string; ratio?: Ratio }

export type Block =
  | { t: 'step'; title: string }                                   // titre d'étape (numérotée automatiquement)
  | { t: 'p'; text: string }                                       // paragraphe (**gras** accepté)
  | { t: 'list'; items: string[]; ordered?: boolean }
  | { t: 'video'; src: string; caption?: string; ratio?: Ratio }
  | { t: 'videos'; items: MediaItem[] }                              // plusieurs vidéos côte à côte (formats, versions)
  | { t: 'compare'; before: MediaItem; after: MediaItem }            // avant / après
  | { t: 'image'; src: string; caption?: string }
  | { t: 'gallery'; items: MediaItem[] }
  | { t: 'audio'; items: MediaItem[] }                               // écoutes (voix, musiques) à comparer
  | { t: 'quote'; text: string; who?: string }                       // retour client, mot pour mot
  | { t: 'prompt'; text: string; title?: string }                    // prompt à copier pour Claude
  | { t: 'code'; text: string; title?: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'tip'; text: string; title?: string }                       // à retenir
  | { t: 'warn'; text: string; title?: string }                      // piège
  | { t: 'todo'; items: string[]; title?: string }                   // à toi de jouer
  | { t: 'quiz'; q: string; options: string[]; answer: number; explain: string }
  | { t: 'tools'; items: { name: string; role: string; url?: string; logo?: string }[] }   // outils : logo officiel + rôle + adresse vérifiée

const media = z.object({ src: z.string().max(300), label: z.string().max(200), note: z.string().max(400).optional(), ratio: z.enum(['16/9', '9/16', '4/5', '1/1']).optional() })
const ratio = z.enum(['16/9', '9/16', '4/5', '1/1']).optional()
const text = z.string().max(8000)

export const blockSchema: z.ZodType<Block> = z.discriminatedUnion('t', [
  z.object({ t: z.literal('step'), title: z.string().max(200) }),
  z.object({ t: z.literal('p'), text }),
  z.object({ t: z.literal('list'), items: z.array(text).max(30), ordered: z.boolean().optional() }),
  z.object({ t: z.literal('video'), src: z.string().max(300), caption: z.string().max(400).optional(), ratio }),
  z.object({ t: z.literal('videos'), items: z.array(media).max(8) }),
  z.object({ t: z.literal('compare'), before: media, after: media }),
  z.object({ t: z.literal('image'), src: z.string().max(300), caption: z.string().max(400).optional() }),
  z.object({ t: z.literal('gallery'), items: z.array(media).max(20) }),
  z.object({ t: z.literal('audio'), items: z.array(media).max(12) }),
  z.object({ t: z.literal('quote'), text, who: z.string().max(200).optional() }),
  z.object({ t: z.literal('prompt'), text, title: z.string().max(200).optional() }),
  z.object({ t: z.literal('code'), text, title: z.string().max(200).optional() }),
  z.object({ t: z.literal('table'), head: z.array(z.string().max(200)).max(8), rows: z.array(z.array(z.string().max(1000)).max(8)).max(40) }),
  z.object({ t: z.literal('tip'), text, title: z.string().max(200).optional() }),
  z.object({ t: z.literal('warn'), text, title: z.string().max(200).optional() }),
  z.object({ t: z.literal('todo'), items: z.array(text).max(15), title: z.string().max(200).optional() }),
  z.object({ t: z.literal('quiz'), q: z.string().max(500), options: z.array(z.string().max(300)).min(2).max(6), answer: z.number().int().min(0), explain: z.string().max(1000) }),
  z.object({ t: z.literal('tools'), items: z.array(z.object({ name: z.string().max(80), role: z.string().max(300), url: z.string().url().max(200).optional(), logo: z.string().max(30).optional() })).max(12) }),
]) as z.ZodType<Block>

/** Lit la colonne jsonb sans jamais planter la page : les étapes invalides sont ignorées. */
export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((b) => {
    const r = blockSchema.safeParse(b)
    return r.success ? [r.data] : []
  })
}

export const isYoutube = (src: string) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(src)

/** Chemin de stockage relatif au dossier du produit : pas de « .. », pas de chemin absolu. */
export const isStoragePath = (src: string) => !isYoutube(src) && !src.includes('..') && /^[\w-]+(\/[\w.-]+)+$/.test(src)

/** Tous les médias du stockage cités par une leçon (pour demander leurs liens signés en une fois). */
export function storagePaths(blocks: Block[]): string[] {
  const out = new Set<string>()
  const add = (src?: string) => { if (src && isStoragePath(src)) out.add(src) }
  for (const b of blocks) {
    if (b.t === 'video' || b.t === 'image') add(b.src)
    if (b.t === 'videos' || b.t === 'gallery' || b.t === 'audio') b.items.forEach((i) => add(i.src))
    if (b.t === 'compare') { add(b.before.src); add(b.after.src) }
  }
  return [...out]
}

export function youtubeEmbed(url: string): string | null {
  const id = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1]
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null
}

/** Temps de lecture estimé d'une leçon (texte à 200 mots/min + durée des vidéos connues). */
export function readingMinutes(blocks: Block[], description?: string | null, videoSeconds?: number | null): number {
  let words = (description ?? '').split(/\s+/).length
  for (const b of blocks) {
    if ('text' in b && typeof b.text === 'string') words += b.text.split(/\s+/).length
    if (b.t === 'list' || b.t === 'todo') words += b.items.join(' ').split(/\s+/).length
  }
  return Math.max(1, Math.round(words / 200 + (videoSeconds ?? 0) / 60))
}
