import { siYoutube, siFacebook, siInstagram, siTiktok } from 'simple-icons'
import { Sparkles } from 'lucide-react'
import { site } from '@/config/site'

// Panneau gauche de la connexion / inscription : le nom et la promesse de la plateforme (site.ts › auth),
// ses domaines posés en briques qui montent une à une, puis un bandeau qui défile.
// Décoratif : masqué aux lecteurs d'écran (le formulaire à droite porte tout le contenu utile).
type Logo = { name: string; path?: string; img?: string; mono?: string; invert?: boolean }

const NETWORKS: Logo[] = [
  { name: 'YouTube', path: siYoutube.path }, { name: 'Facebook', path: siFacebook.path }, { name: 'TikTok', path: siTiktok.path },
  { name: 'Instagram', path: siInstagram.path }, { name: 'LinkedIn', mono: 'in' },
]
const PAYMENTS: Logo[] = [
  { name: 'Mobile Money', mono: 'MM' }, { name: 'Wave', mono: 'W' }, { name: 'Carte bancaire', mono: 'CB' }, { name: 'PayPal', mono: 'P' }, { name: 'USDT', mono: '₮' },
]

// Le mur, de bas en haut, rangées de 3 puis 2 : les domaines de site.hero.chips.
const WALL: string[][] = site.hero.chips.reduce<string[][]>((rows, chip) => {
  const last = rows[rows.length - 1]
  if (!last || last.length >= (rows.length % 2 ? 2 : 3)) rows.push([chip])
  else last.push(chip)
  return rows
}, [])

function LogoChip({ l }: { l: Logo }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-1 pr-3">
      <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-white/10">
        {l.path ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d={l.path} /></svg>
          // eslint-disable-next-line @next/next/no-img-element
          : l.img ? <img src={l.img} alt="" className={l.invert ? 'h-4 w-4 brightness-0 invert' : 'h-7 w-7 object-cover'} />
          : <span className="text-[11px] font-bold">{l.mono}</span>}
      </span>
      <span className="whitespace-nowrap text-[13px] text-white/85">{l.name}</span>
    </span>
  )
}

// Un seul bandeau qui défile : moyens de paiement et réseaux, mélangés.
const ALL: Logo[] = PAYMENTS.flatMap((p, i) => [p, NETWORKS[i]].filter(Boolean))

function Marquee({ items }: { items: Logo[] }) {
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="auth-marquee flex w-max gap-2.5">
        {[...items, ...items].map((l, i) => <LogoChip key={`${l.name}-${i}`} l={l} />)}
      </div>
    </div>
  )
}

export function AuthHero({ mode }: { mode: 'login' | 'signup' }) {
  let n = 0
  return (
    <aside className="auth-hero relative hidden overflow-hidden bg-[#0B0B0C] text-white lg:flex lg:flex-col" aria-hidden>
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]" />
      <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-brand/25 blur-[120px]" />

      <div className="relative flex items-center gap-3 px-10 pt-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt="" className="h-10 w-10 rounded-full border border-white/20 object-cover" />
        <span className="text-lg font-medium tracking-tight">{site.name}<span className="text-brand">.</span></span>
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-7 px-10 py-6">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand"><Sparkles className="h-3.5 w-3.5" />{mode === 'signup' ? site.auth.signupKicker : site.auth.loginKicker}</p>
          <h2 className="mt-3 text-[36px] leading-[1.1] tracking-tight">{mode === 'signup' ? site.auth.signupTitle : site.auth.loginTitle}</h2>
          <p className="mt-3 max-w-lg text-[16px] leading-7 text-white/70">{site.tagline}</p>
          {site.auth.mission && <p className="mt-4 max-w-lg border-l-2 border-brand pl-4 text-[14px] leading-6 text-white/65">{site.auth.mission}</p>}
        </div>

        {/* Le mur qui se construit : chaque domaine est une brique posée, de bas en haut. */}
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/45">Ce que tu trouves ici</p>
          <div className="flex max-w-xl flex-col-reverse gap-[5px] rounded-md border-b-2 border-white/15 pb-[5px]">
            {WALL.map((row, r) => (
              <div key={r} className={r % 2 ? 'flex gap-[5px] pl-7' : 'flex gap-[5px] pr-7'}>
                {row.map((label) => {
                  const i = n++
                  return (
                    <span key={label} className={`auth-brick flex-1 whitespace-nowrap rounded-[4px] px-3 py-2 text-center text-[13px] font-medium text-white ${i % 2 ? 'bg-brand-hover' : 'bg-brand'}`}
                      style={{ animationDelay: `${0.3 + i * 0.32}s` }}>{label}</span>
                  )
                })}
                {r === WALL.length - 1 && (
                  <span className="auth-brick auth-brick-next flex-1 rounded-[4px] border border-dashed px-3 py-2 text-center text-[13px] text-white/70" style={{ animationDelay: `${0.3 + n * 0.32}s` }}>+ ta brique</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[11px] uppercase tracking-[0.18em] text-white/45">Paiements acceptés et réseaux</p>
          <Marquee items={ALL} />
        </div>
      </div>

      <div className="relative flex items-center justify-between px-10 pb-7 text-sm text-white/50">
        <span>{site.person || site.name}</span>
        <span className="text-white/70">{site.auth.footer}</span>
      </div>
    </aside>
  )
}
