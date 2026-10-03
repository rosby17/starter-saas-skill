'use client'

import { useCallback, useEffect, useState } from 'react'
import { Checkbox, RadioCard } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'

type Step = { id: string; label: string; status: 'pending' | 'running' | 'done' | 'error' | 'skipped'; detail?: string }
type Data = {
  settings: { domain?: string; dnsProvider?: 'hostinger' | 'cloudflare' | 'manual'; serverUuid?: string; serverIp?: string; appUuid?: string; repoFullName?: string }
  state: { running: boolean; mode: string; steps: Step[]; url?: string; error?: string; finishedAt?: string } | null
  keys: Record<string, boolean>
  servers: Array<{ uuid: string; name: string; ip: string }>
  serversError: string | null
  local: boolean
}

const KEY_LABELS: Record<string, string> = {
  COOLIFY_URL: 'Adresse de Coolify', COOLIFY_API_TOKEN: 'Jeton Coolify', GITHUB_TOKEN: 'Jeton GitHub',
  HOSTINGER_API_TOKEN: 'Jeton Hostinger', CLOUDFLARE_API_TOKEN: 'Jeton Cloudflare',
}

const ICON: Record<Step['status'], string> = { pending: '○', running: '◌', done: '✓', error: '✕', skipped: '–' }

// MISE EN LIGNE : l'administrateur colle ses clés, choisit domaine et serveur, clique. Tout le reste est automatique.
export default function DeployPage() {
  const [data, setData] = useState<Data | null>(null)
  const [domain, setDomain] = useState('')
  const [ip, setIp] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [offer, setOffer] = useState<{ domain: string; available: boolean; price: { id: string; amount: number; currency: string } | null } | null>(null)
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/deploy')
    const d = await res.json()
    if (!d.success) return setMessage({ ok: false, text: d.message })
    setData(d)
    setDomain((v) => v || d.settings.domain || '')
    setIp((v) => v || d.settings.serverIp || '')
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!data?.state?.running) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [data?.state?.running, load])

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage(null)
    const res = await fetch('/api/admin/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json()
    setBusy(false)
    if (!d.success) setMessage({ ok: false, text: d.message })
    await load()
    return d
  }

  if (!data) return <main className="p-8 text-sm text-gray-500">Chargement…</main>
  const s = data.settings
  const provider = s.dnsProvider || 'hostinger'
  const missing = ['COOLIFY_URL', 'COOLIFY_API_TOKEN', ...(data.local ? ['GITHUB_TOKEN'] : []), ...(provider === 'hostinger' ? ['HOSTINGER_API_TOKEN'] : provider === 'cloudflare' ? ['CLOUDFLARE_API_TOKEN'] : [])].filter((k) => !data.keys[k])
  const ready = missing.length === 0 && !!s.domain && !!s.serverUuid && !!s.serverIp
  const server = data.servers.find((x) => x.uuid === s.serverUuid)

  const chooseServer = (uuid: string) => {
    const srv = data.servers.find((x) => x.uuid === uuid)
    const guessed = srv && /^\d{1,3}(\.\d{1,3}){3}$/.test(srv.ip) ? srv.ip : ip
    setIp(guessed)
    post({ action: 'save', serverUuid: uuid, ...(guessed ? { serverIp: guessed } : {}) })
  }

  const checkDomain = async () => {
    setOffer(null); setAccept(false)
    const d = await post({ action: 'check-domain', domain })
    if (d.success) setOffer(d)
  }

  const buy = async () => {
    if (!offer?.price) return
    const ok = await confirm({ title: `Acheter ${offer.domain} ?`, message: `${offer.price.amount.toFixed(2)} ${offer.price.currency} la première année, payés avec le moyen de paiement enregistré chez Hostinger.`, confirmLabel: 'Acheter' })
    if (!ok) return
    const d = await post({ action: 'buy-domain', domain: offer.domain, priceId: offer.price.id, confirmed: true })
    if (d.success) { setOffer(null); setMessage({ ok: true, text: `${offer.domain} acheté. Il peut falloir quelques minutes avant qu'il soit réglable.` }) }
  }

  const launch = async (action: 'deploy' | 'redeploy') => {
    const ok = await confirm({
      title: action === 'deploy' ? `Mettre ${s.domain} en ligne ?` : 'Redéployer le site ?',
      message: action === 'deploy' ? 'Le code part dans un dépôt GitHub privé, Coolify construit le site et le domaine est pointé vers ton serveur. Compte 5 à 15 minutes.' : 'Le site est reconstruit avec la dernière version du code et des réglages.',
      confirmLabel: action === 'deploy' ? 'Mettre en ligne' : 'Redéployer',
    })
    if (ok) await post({ action })
  }

  return (
    <main className="max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Mise en ligne</h1>
      <p className="mb-6 text-sm text-gray-500">Colle tes clés, choisis ton domaine et ton serveur, puis un clic : dépôt privé, serveur, domaine, HTTPS, tâches automatiques. Tout est fait pour toi.</p>
      {message && <div className={`mb-4 rounded-xl border p-3 text-sm ${message.ok ? 'border-green-100 bg-green-50 text-green-700' : 'border-red-100 bg-red-50 text-red-700'}`}>{message.text}</div>}

      <section className="mb-6 rounded-2xl border border-gray-200 p-5">
        <h2 className="mb-3 font-semibold">1. Tes clés</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(KEY_LABELS).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span>{label}</span>
              {data.keys[k] ? <span className="text-xs text-green-700">renseignée</span> : <a href={`/admin/keys?focus=${k}#${k}`} className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-hover">Renseigner</a>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Seuls Coolify, GitHub et le jeton de ton fournisseur de domaine sont indispensables. La base de données est installée sur ton serveur par Coolify, à l’adresse api.ton-domaine.com : aucun compte à créer ailleurs.</p>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 p-5">
        <h2 className="mb-3 font-semibold">2. Ton nom de domaine</h2>
        <div role="radiogroup" className="mb-3 grid gap-2 sm:grid-cols-3">
          <RadioCard checked={provider === 'hostinger'} onSelect={() => post({ action: 'save', dnsProvider: 'hostinger' })} label="Hostinger" />
          <RadioCard checked={provider === 'cloudflare'} onSelect={() => post({ action: 'save', dnsProvider: 'cloudflare' })} label="Cloudflare" />
          <RadioCard checked={provider === 'manual'} onSelect={() => post({ action: 'save', dnsProvider: 'manual' })} label="Ailleurs" />
        </div>
        <div className="flex gap-2">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="monsaas.com" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          <button type="button" disabled={busy || !domain} onClick={() => post({ action: 'save', domain })} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">Enregistrer</button>
          {provider === 'hostinger' && data.keys.HOSTINGER_API_TOKEN && (
            <button type="button" disabled={busy || !domain} onClick={checkDomain} className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">Pas encore acheté ?</button>
          )}
        </div>
        {offer && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            {!offer.available ? <p>{offer.domain} n’est pas disponible. S’il est déjà à toi, clique simplement « Enregistrer ».</p> : !offer.price ? <p>{offer.domain} est libre, mais son prix est introuvable : achète-le dans hPanel.</p> : (
              <div className="space-y-3">
                <p><b>{offer.domain}</b> est libre : {offer.price.amount.toFixed(2)} {offer.price.currency} la première année.</p>
                <Checkbox checked={accept} onChange={setAccept} label="J’accepte cet achat, payé avec le moyen de paiement enregistré chez Hostinger." />
                <button type="button" disabled={!accept || busy} onClick={buy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">Acheter ce domaine</button>
              </div>
            )}
          </div>
        )}
        {provider === 'manual' && s.serverIp && s.domain && (
          <p className="mt-3 text-xs text-gray-600">Chez ton fournisseur, crée : un enregistrement <b>A</b> « @ » → <code>{s.serverIp}</code>, et un <b>CNAME</b> « www » → <code>{s.domain}</code>.</p>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 p-5">
        <h2 className="mb-3 font-semibold">3. Ton serveur</h2>
        {data.serversError && <p className="mb-2 text-sm text-red-700">{data.serversError}</p>}
        {!data.keys.COOLIFY_API_TOKEN ? <p className="text-sm text-gray-500">Renseigne d’abord l’adresse et le jeton Coolify.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="mb-1 text-xs text-gray-500">Serveur Coolify</p>
              <Select value={s.serverUuid || ''} onChange={chooseServer} placeholder="Choisir le serveur" options={data.servers.map((x) => ({ value: x.uuid, label: x.name, hint: x.ip }))} />
            </div>
            <div><p className="mb-1 text-xs text-gray-500">Adresse IP publique du serveur</p>
              <div className="flex gap-2">
                <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.10" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
                <button type="button" disabled={busy || !ip || ip === s.serverIp} onClick={() => post({ action: 'save', serverIp: ip })} className="rounded-lg border border-gray-200 px-3 text-sm hover:bg-gray-50 disabled:opacity-40">OK</button>
              </div>
              {server && !/^\d/.test(server.ip) && <p className="mt-1 text-xs text-amber-700">Coolify indique « {server.ip} » : mets l’IP publique de ta machine (visible chez ton hébergeur).</p>}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 p-5">
        <h2 className="mb-3 font-semibold">4. En ligne</h2>
        {missing.length > 0 && <p className="mb-3 text-sm text-amber-700">Il manque : {missing.map((k) => KEY_LABELS[k]).join(', ')}.</p>}
        <div className="flex flex-wrap gap-2">
          {data.local && (
            <button type="button" disabled={!ready || busy || data.state?.running} onClick={() => launch('deploy')} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">
              {s.appUuid ? 'Envoyer la nouvelle version' : 'Mettre en ligne'}
            </button>
          )}
          {s.appUuid && (
            <button type="button" disabled={busy || data.state?.running} onClick={() => launch('redeploy')} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-40">Redéployer</button>
          )}
        </div>
        {!data.local && !s.appUuid && <p className="mt-2 text-xs text-gray-500">La première mise en ligne se lance depuis ton ordinateur, là où se trouve le code.</p>}

        {data.state && (
          <ol className="mt-5 space-y-2">
            {data.state.steps.map((step) => (
              <li key={step.id} className="flex gap-3 text-sm">
                <span className={`w-4 text-center ${step.status === 'done' ? 'text-green-600' : step.status === 'error' ? 'text-red-600' : step.status === 'running' ? 'animate-pulse text-brand' : 'text-gray-400'}`}>{ICON[step.status]}</span>
                <span className={step.status === 'pending' ? 'text-gray-400' : ''}>
                  {step.label}
                  {step.detail && <span className={`block text-xs ${step.status === 'error' ? 'text-red-700' : 'text-gray-500'}`}>{step.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {data.state?.url && !data.state.running && (
          <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">Ton SaaS est en ligne : <a className="font-medium underline" href={data.state.url} target="_blank" rel="noreferrer">{data.state.url}</a></div>
        )}
      </section>
    </main>
  )
}
