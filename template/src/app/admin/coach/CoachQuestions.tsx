'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Questions libres au coach : réponse courte d'abord, puis les chiffres qui comptent et les priorités.

type Advice = { answer: string; cards: { title: string; value: string; detail: string }[]; priorities: string[]; suggestedQuestions: string[] }

const STARTERS = ['Quelle offre lancer ce mois-ci pour atteindre l’objectif ?', 'Pourquoi les inscrits n’achètent-ils pas ?', 'Comment augmenter le panier moyen ?']

export function CoachQuestions() {
  const [question, setQuestion] = useState('')
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const ask = async (q: string) => {
    if (q.trim().length < 2) return
    setQuestion(q)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/coach/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
      const json = await res.json()
      if (!json.success) setError(json.message)
      else setAdvice(json.advice)
    } catch {
      setError('Le coach ne répond pas : vérifiez la connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold">Poser une question au coach</h2>
        <p className="text-sm text-gray-500">Il répond avec les chiffres du site (sans jamais voir l’identité des clients).</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void ask(question) }} className="space-y-3">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={1200} aria-label="Votre question"
          placeholder="Ex. : quels clients relancer en priorité cette semaine ?" className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-gray-400" />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading || question.trim().length < 2}>{loading ? 'Le coach réfléchit…' : 'Demander'}</Button>
          {!advice && STARTERS.map((s) => <button key={s} type="button" onClick={() => ask(s)} disabled={loading} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-300">{s}</button>)}
        </div>
      </form>
      {error && <p role="alert" className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {advice && (
        <div className="space-y-4">
          <p className="whitespace-pre-line text-sm">{advice.answer}</p>
          {advice.cards.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {advice.cards.map((c, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{c.title}</p>
                  <p className="font-bold">{c.value}</p>
                  <p className="mt-1 text-sm text-gray-600">{c.detail}</p>
                </div>
              ))}
            </div>
          )}
          {advice.priorities.length > 0 && <div><h3 className="text-sm font-semibold">Priorités</h3><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{advice.priorities.map((p, i) => <li key={i}>{p}</li>)}</ol></div>}
          {advice.suggestedQuestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {advice.suggestedQuestions.map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={loading} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-300">{q}</button>)}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
