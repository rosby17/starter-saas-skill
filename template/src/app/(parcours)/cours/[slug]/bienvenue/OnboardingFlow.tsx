'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Briefcase, CalendarDays, Circle, Clapperboard, Coffee, Compass, Film, HardDrive, Laptop, MessageSquare, Mic, Monitor, MonitorPlay, Rocket, Scissors, Sprout, Target, Terminal, Timer, Wrench, Zap, Check, ArrowLeft, BookOpen, type LucideIcon } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { QUESTIONS, personalPlan, type Answers, type PersonalPlan, type Question } from '@/lib/course/onboarding'
import { site } from '@/config/site'

const ICONS: Record<string, LucideIcon> = { Briefcase, CalendarDays, Circle, Clapperboard, Coffee, Film, HardDrive, Laptop, MessageSquare, Mic, Monitor, MonitorPlay, Rocket, Scissors, Sprout, Terminal, Timer, Zap }

const BUILD_STEPS = ['Lecture de tes réponses', 'Choix de ton point de départ', 'Calcul de ton rythme', 'Préparation de ton parcours']
type Screen = { kind: 'splash' } | { kind: 'question'; q: Question; index: number } | { kind: 'building' } | { kind: 'plan' }

// Accueil d'une formation, une question par écran (même expérience que le bilan santé de Next Age Health) :
// barre de progression, grandes cartes, réponse en un clic, puis « ton parcours est prêt ».
export function OnboardingFlow({ slug, courseTitle, initial, knownName, stats }: {
  slug: string
  courseTitle: string
  initial: Answers
  /** Prénom déjà connu (compte, commande) : on ne le redemande pas. */
  knownName: string
  stats: { modules: number; lessons: number; videoMinutes: number }
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>(knownName ? { ...initial, firstName: initial.firstName || knownName } : initial)
  const [plan, setPlan] = useState<PersonalPlan | null>(null)
  const questions = useMemo(() => QUESTIONS.filter((q) => !(q.id === 'firstName' && knownName)), [knownName])
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const screens: Screen[] = useMemo(() => [
    { kind: 'splash' },
    ...questions.map((q, index) => ({ kind: 'question' as const, q, index })),
    { kind: 'building' },
    { kind: 'plan' },
  ], [questions])
  const screen = screens[step]
  const name = typeof answers.firstName === 'string' ? answers.firstName : ''

  const save = async (next: Answers, completed = false) => {
    const res = await fetch(`/api/courses/${slug}/onboarding`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: next, completed }),
    }).catch(() => null)
    return !!res?.ok
  }

  const answer = (id: string, value: string | string[], advance: boolean) => {
    const next = { ...answers, [id]: value }
    setAnswers(next)
    if (advance) {
      void save(next)
      setTimeout(() => setStep((s) => s + 1), 200)
    }
  }

  // Fin du questionnaire : réponses enregistrées, puis plan préparé par le serveur (IA, ou règles en repli).
  const buildPlan = async () => {
    setError('')
    await save(answers)
    const res = await fetch(`/api/courses/${slug}/plan`, { method: 'POST' }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.success) setPlan(data.plan)
    else { setPlan(personalPlan(answers)); setError('Ton parcours n’a pas pu être enregistré. Vérifie ta connexion et réessaie.') }
  }
  const finish = async () => {
    if (error && !(await save(answers, true))) return
    router.push(`/cours/${slug}`)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 pt-5">
        {step > 0 && screen.kind !== 'building' ? (
          // Depuis l'écran final, on revient à la DERNIÈRE question (pas à l'écran de calcul, qui repartirait en avant).
          <button type="button" onClick={() => setStep((s) => (screen.kind === 'plan' ? questions.length : Math.max(0, s - 1)))} aria-label="Étape précédente"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"><ArrowLeft className="h-5 w-5" strokeWidth={1.8} /></button>
        ) : <span className="h-9 w-9 shrink-0" />}
        {/* Une étape par question : celles déjà vues se rouvrent d'un clic. */}
        <nav className="flex flex-1 gap-1.5" aria-label={`Question ${screen.kind === 'question' ? screen.index + 1 : questions.length} sur ${questions.length}`}>
          {questions.map((q, i) => {
            const reached = step >= i + 1 || answers[q.id] !== undefined
            const current = screen.kind === 'question' && screen.index === i
            return (
              <button key={q.id} type="button" disabled={!reached} onClick={() => setStep(i + 1)} aria-label={`Question ${i + 1} : ${q.title}`} aria-current={current ? 'step' : undefined}
                className={clsx('h-1.5 flex-1 rounded-full transition-colors disabled:cursor-default', current ? 'bg-brand' : reached ? 'bg-brand/45 hover:bg-brand/70' : 'bg-gray-200')} />
            )
          })}
        </nav>
        <Link href={`/cours/${slug}`} onClick={async (e) => { e.preventDefault(); await save(answers, true); router.push(`/cours/${slug}`) }} className="shrink-0 text-xs text-gray-500 hover:text-gray-900">Passer</Link>
      </header>

      <main className="flex flex-1 flex-col">
        {screen.kind === 'splash' && (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 pb-10 text-center">
            <div className="relative grid h-40 w-40 place-items-center">
              <span className="absolute inset-0 rounded-full bg-brand/15" style={{ animation: 'courseBreathe 2.4s ease-in-out infinite' }} />
              <Image src={site.logo} alt={site.name} width={128} height={128} className="relative h-32 w-32 rounded-full object-cover" priority />
            </div>
            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-brand">Bienvenue{name ? `, ${name}` : ''}</p>
            <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{courseTitle}</h1>
            <p className="mt-4 max-w-md text-gray-600">
              Avant de commencer, {questions.length} petites questions pour préparer ton parcours. Moins d’une minute.
            </p>
            <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3 text-center">
              {[[stats.modules, 'modules'], [stats.lessons, 'leçons'], [stats.videoMinutes, 'min de vidéo']].map(([n, l]) => (
                <div key={l} className="rounded-2xl border border-gray-200 bg-surface px-3 py-4">
                  <p className="text-2xl font-medium">{n}</p>
                  <p className="text-xs text-gray-500">{l}</p>
                </div>
              ))}
            </div>
            <Continue label="C’est parti" onClick={() => setStep(1)} />
          </div>
        )}

        {screen.kind === 'question' && (
          <QuestionScreen key={screen.q.id} q={screen.q} value={answers[screen.q.id]}
            onAnswer={(v, advance) => answer(screen.q.id, v, advance)}
            onContinue={() => { void save(answers); setStep((s) => s + 1) }} />
        )}

        {screen.kind === 'building' && <Building start={buildPlan} ready={plan !== null} onDone={() => setStep((s) => s + 1)} />}

        {screen.kind === 'plan' && <Plan plan={plan ?? personalPlan(answers)} name={name} onStart={finish} error={error} />}
      </main>
    </div>
  )
}

function Continue({ onClick, disabled, label = 'Continuer' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <div className="sticky bottom-0 mt-auto w-full bg-gradient-to-t from-gray-50 from-60% to-transparent pb-5 pt-10">
      <button type="button" onClick={onClick} disabled={disabled}
        className="w-full rounded-2xl bg-brand py-4 text-lg font-medium text-white transition-all hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-500">
        {label}
      </button>
    </div>
  )
}

function QuestionScreen({ q, value, onAnswer, onContinue }: {
  q: Question
  value: string | string[] | undefined
  onAnswer: (v: string | string[], advance: boolean) => void
  onContinue: () => void
}) {
  const [text, setText] = useState(typeof value === 'string' ? value : '')
  const selected = Array.isArray(value) ? value : []

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-4">
      <div className="pt-8" style={{ animation: 'courseRise 0.4s ease-out both' }}>
        <h2 className="text-2xl leading-tight sm:text-3xl">{q.title}</h2>
        {q.subtitle && <p className="mt-2 text-gray-500">{q.subtitle}</p>}
      </div>

      {q.kind === 'text' ? (
        <>
          <input autoFocus value={text} maxLength={40} placeholder={q.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onAnswer(text.trim(), false); onContinue() } }}
            className="mt-8 w-full rounded-2xl border-2 border-gray-200 bg-surface px-5 py-4 text-xl outline-none focus:border-brand" />
          <Continue disabled={!text.trim()} onClick={() => { onAnswer(text.trim(), false); onContinue() }} />
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-3" role={q.kind === 'single' ? 'radiogroup' : 'group'}>
            {q.options.map((o, i) => {
              const on = q.kind === 'multi' ? selected.includes(o.value) : value === o.value
              return (
                <button key={o.value} type="button" role={q.kind === 'single' ? 'radio' : 'checkbox'} aria-checked={on}
                  onClick={() => {
                    if (q.kind === 'single') return onAnswer(o.value, true)
                    onAnswer(on ? selected.filter((v) => v !== o.value)
                      : q.exclusive?.includes(o.value) ? [o.value]
                      : [...selected.filter((v) => !q.exclusive?.includes(v)), o.value], false)
                  }}
                  className={clsx('flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all hover:-translate-y-0.5',
                    on ? 'border-brand bg-brand/10' : 'border-gray-200 bg-surface hover:border-gray-300')}
                  style={{ animation: `courseRise 0.4s ease-out ${i * 50}ms both` }}>
                  {o.icon && ICONS[o.icon] && (() => { const I = ICONS[o.icon!]; return <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700')} aria-hidden><I className="h-5 w-5" strokeWidth={1.8} /></span> })()}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.label}</span>
                    {o.hint && <span className="block text-sm text-gray-500">{o.hint}</span>}
                  </span>
                  <span className={clsx('grid h-6 w-6 shrink-0 place-items-center border-2 text-xs text-white transition-colors',
                    q.kind === 'multi' ? 'rounded-md' : 'rounded-full', on ? 'border-brand bg-brand' : 'border-gray-300')}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
          {q.why && (
            <p className="mt-5 rounded-2xl border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600">
              <span className="font-medium text-gray-900">Pourquoi cette question ?</span> {q.why}
            </p>
          )}
          {q.kind === 'multi' && <Continue disabled={!selected.length} onClick={onContinue} />}
        </>
      )}
    </div>
  )
}

function Building({ start, ready, onDone }: { start: () => Promise<void>; ready: boolean; onDone: () => void }) {
  const [done, setDone] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => { if (!started) { setStarted(true); void start() } }, [started, start])
  useEffect(() => {
    // La dernière étape attend le plan (IA : quelques secondes).
    if (done >= BUILD_STEPS.length) {
      if (!ready) return
      const t = setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }
    if (done === BUILD_STEPS.length - 1 && !ready) return
    const t = setTimeout(() => setDone((d) => d + 1), 700)
    return () => clearTimeout(t)
  }, [done, ready, onDone])

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 rounded-full border-4 border-gray-200" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand" />
        <span className="text-2xl font-medium">{Math.round((done / BUILD_STEPS.length) * 100)}%</span>
      </div>
      <h2 className="mt-8 text-2xl">Je prépare ton parcours…</h2>
      <ul className="mt-6 w-full space-y-3 text-left">
        {BUILD_STEPS.map((s, i) => (
          <li key={s} className={clsx('flex items-center gap-3 text-sm transition-opacity', i < done ? 'opacity-100' : 'opacity-40')}>
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full', i < done ? 'bg-brand text-white' : 'border border-gray-300')}>{i < done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Plan({ plan, name, onStart, error }: { plan: PersonalPlan; name: string; onStart: () => void; error: string }) {
  const cards: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Target, title: 'Ton point de départ', text: plan.start },
    { icon: Compass, title: 'Pour ton objectif', text: plan.goal },
    { icon: CalendarDays, title: 'Ton rythme', text: plan.rhythm },
  ]
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-4 pt-8">
      <p className="text-sm uppercase tracking-[0.2em] text-brand" style={{ animation: 'courseRise 0.4s ease-out both' }}>Ton parcours est prêt</p>
      <h2 className="mt-2 text-3xl leading-tight" style={{ animation: 'courseRise 0.4s ease-out 60ms both' }}>
        {name ? `${name}, voici` : 'Voici'} comment on avance ensemble.
      </h2>
      {plan.intro && <p className="mt-3 text-[16px] leading-7 text-gray-600" style={{ animation: 'courseRise 0.4s ease-out 90ms both' }}>{plan.intro}</p>}
      {plan.summary.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.summary.map((s) => <span key={s} className="rounded-full border border-gray-200 bg-surface px-3 py-1 text-xs text-gray-600">{s}</span>)}
        </div>
      )}
      <div className="mt-6 space-y-3">
        {cards.map((c, i) => (
          <div key={c.title} className="flex gap-4 rounded-2xl border border-gray-200 bg-surface p-5" style={{ animation: `courseRise 0.45s ease-out ${120 + i * 90}ms both` }}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-700" aria-hidden><c.icon className="h-5 w-5" strokeWidth={1.8} /></span>
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{c.text}</p>
            </div>
          </div>
        ))}
        {plan.focus && plan.focus.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-surface p-5" style={{ animation: 'courseRise 0.45s ease-out 380ms both' }}>
            <p className="flex items-center gap-2 font-medium"><BookOpen className="h-5 w-5 text-gray-700" strokeWidth={1.8} /> Les leçons à ne pas manquer</p>
            <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
              {plan.focus.map((t) => <li key={t} className="flex gap-2"><span className="text-brand">•</span>{t}</li>)}
            </ul>
          </div>
        )}
        {plan.install.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-surface p-5" style={{ animation: 'courseRise 0.45s ease-out 440ms both' }}>
            <p className="flex items-center gap-2 font-medium"><Wrench className="h-5 w-5 text-gray-700" strokeWidth={1.8} /> À préparer avant la première leçon</p>
            <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
              {plan.install.map((t) => <li key={t} className="flex gap-2"><span className="text-brand">•</span>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Continue label="Entrer dans la formation →" onClick={onStart} />
    </div>
  )
}
