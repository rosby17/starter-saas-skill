'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { track } from '@/components/site/MetaPixel'
import { contactLink, contactChannel } from '@/config/site'

type State = 'loading' | 'waiting_payment' | 'completed' | 'failed' | 'review' | 'unknown'
type Info = { amount: number; plan_name: string; email: string | null; manual: boolean }

const POLL_MS = 3000
const MAX_POLLS = 120 // ~6 minutes, puis on propose de revenir plus tard (le paiement sera livré quand même)

// Suivi d'un paiement : interroge /api/payment/verify jusqu'à la confirmation, puis donne l'accès.
export default function PaymentStatus() {
  const cartId = useSearchParams().get('cartId') || ''
  const [state, setState] = useState<State>('loading')
  const [info, setInfo] = useState<Info | null>(null)
  const [canEnter, setCanEnter] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [entering, setEntering] = useState(false)
  const [message, setMessage] = useState('')
  const polls = useRef(0)
  const tracked = useRef(false)

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment/verify?cartId=${encodeURIComponent(cartId)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!data.success) {
        setState('unknown')
        return true
      }
      setInfo(data.order)
      setCanEnter(!!data.canEnter)
      setSignedIn(!!data.signedIn)
      setState(data.cart.status)
      if (data.cart.status === 'completed' && !tracked.current) {
        tracked.current = true
        track('Purchase', { value: data.order.amount, currency: 'XAF', content_name: data.order.plan_name })
      }
      return data.cart.status !== 'waiting_payment'
    } catch {
      return false
    }
  }, [cartId])

  useEffect(() => {
    if (!cartId) {
      setState('unknown')
      return
    }
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      const done = await check()
      polls.current += 1
      if (!stop && !done && polls.current < MAX_POLLS) timer = setTimeout(loop, POLL_MS)
    }
    loop()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [cartId, check])

  const enter = async () => {
    setEntering(true)
    setMessage('')
    const res = await fetch('/api/payment/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cartId }) })
    const data = await res.json().catch(() => ({}))
    if (data.success && data.url) {
      window.location.href = data.url
      return
    }
    setEntering(false)
    setMessage(data.message || 'Ouvre le lien reçu par e-mail pour accéder à ton espace.')
  }

  return (
    <div style={card}>
      {state === 'loading' && <Title>Vérification du paiement…</Title>}

      {state === 'waiting_payment' && (
        <>
          <Spinner />
          <Title>{info?.manual ? 'Paiement en cours de vérification' : 'On attend la confirmation de ton paiement…'}</Title>
          <Text>
            {info?.manual
              ? "Dès que j'ai vérifié ton paiement Binance, ton accès est activé et tu reçois un e-mail. Envoie la capture de ta transaction sur WhatsApp pour aller plus vite."
              : "Ça prend en général quelques secondes. Garde cette page ouverte : elle se met à jour toute seule."}
          </Text>
          {info?.manual && (
            <a href={contactLink()} target="_blank" rel="noopener noreferrer" style={secondary}>Envoyer ma capture sur WhatsApp</a>
          )}
          {polls.current >= MAX_POLLS && (
            <Text>Pas encore de confirmation. Pas d&apos;inquiétude : dès que le paiement arrive, ton accès est activé et un e-mail t&apos;est envoyé.</Text>
          )}
        </>
      )}

      {state === 'completed' && (
        <>
          <p style={{ fontSize: 44, marginBottom: 8 }} aria-hidden>✓</p>
          <Title>Paiement confirmé. Ton accès est prêt.</Title>
          {info && <Text><strong style={{ color: 'var(--white)' }}>{info.plan_name}</strong></Text>}
          {signedIn ? (
            <Link href="/mes-achats" style={primary}>Accéder à mes achats</Link>
          ) : canEnter ? (
            <button type="button" onClick={enter} disabled={entering} style={{ ...primary, border: 'none', cursor: 'pointer' }}>
              {entering ? 'Ouverture…' : 'Accéder maintenant'}
            </button>
          ) : null}
          <Text>
            Un e-mail avec ton lien d&apos;accès a été envoyé à <strong style={{ color: 'var(--white)' }}>{info?.email || 'ton adresse'}</strong>
            {' '}(regarde aussi dans les spams). Tu pourras revenir quand tu veux depuis la page{' '}
            <Link href="/login" style={{ color: 'var(--brand)' }}>Connexion</Link>, avec ton e-mail.
          </Text>
          {message && <Text>{message}</Text>}
        </>
      )}

      {state === 'failed' && (
        <>
          <Title>Le paiement n&apos;a pas abouti.</Title>
          <Text>Aucun montant n&apos;a été débité pour cette commande. Tu peux réessayer depuis la boutique.</Text>
          <Link href="/boutique" style={primary}>Retour à la boutique</Link>
          <HelpLink />
        </>
      )}

      {state === 'review' && (
        <>
          <Title>Paiement reçu, vérification en cours.</Title>
          <Text>Le montant reçu doit être vérifié à la main. Ton accès arrive par e-mail dès que c&apos;est fait.</Text>
          <HelpLink />
        </>
      )}

      {state === 'unknown' && (
        <>
          <Title>Commande introuvable sur cet appareil.</Title>
          <Text>Si tu as payé, ton accès t&apos;a été envoyé par e-mail. Tu peux aussi te connecter avec ton adresse e-mail pour retrouver tes achats.</Text>
          <Link href="/login?next=/mes-achats" style={primary}>Me connecter</Link>
          <HelpLink />
        </>
      )}
    </div>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', lineHeight: 1.15, color: 'var(--white)', marginBottom: 14 }}>{children}</h1>
}
function Text({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'var(--white-muted)', lineHeight: 1.65, margin: '10px 0' }}>{children}</p>
}
function HelpLink() {
  return <Text>Un souci ? <a href={contactLink()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>Écris-nous sur {contactChannel()}</a>.</Text>
}
function Spinner() {
  return <div aria-hidden style={{ width: 36, height: 36, margin: '0 auto 18px', borderRadius: '50%', border: '3px solid var(--black-line)', borderTopColor: 'var(--brand)', animation: 'spin 0.9s linear infinite' }}><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></div>
}

const card: React.CSSProperties = { width: '100%', maxWidth: 560, textAlign: 'center', padding: '40px 28px', borderRadius: 24, background: 'var(--black-card)', border: '1px solid var(--black-line)' }
const primary: React.CSSProperties = { display: 'inline-flex', margin: '18px 0 8px', padding: '14px 26px', borderRadius: 999, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 16, textDecoration: 'none' }
const secondary: React.CSSProperties = { ...primary, background: 'transparent', border: '1px solid var(--black-line)', color: 'var(--white)' }
