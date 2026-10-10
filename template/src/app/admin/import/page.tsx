'use client'

import { useEffect, useRef, useState } from 'react'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/choice'
import { Button } from '@/components/ui/button'
import { Notice, api, inputClass } from '@/components/admin/kit'

type Report = { total: number; created: number; granted: number; dryRun: boolean; report: Array<{ line: number; email: string; result: string; ok: boolean }> }

// Import des anciens acheteurs : export du tableau de bord Maketou, liste tenue à la main, contacts WhatsApp…
export default function AdminImportPage() {
  const [csv, setCsv] = useState('')
  const [products, setProducts] = useState<Array<{ id: string; title: string; external_url: string | null }>>([])
  const [productId, setProductId] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ products: Array<{ id: string; title: string; external_url: string | null }> }>('/api/admin/products').then((d) => d.success && setProducts(d.products.filter((p) => !p.external_url)))
  }, [])

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    const d = await api<Report>('/api/admin/import', 'POST', { csv, defaultProductId: productId || null, notify, dryRun })
    setBusy(false)
    if (!d.success) return setError(d.message || 'Import impossible.')
    setResult(d)
  }

  return (
    <main className="max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl">Importer des acheteurs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pour tes anciens clients (export du tableau de bord Maketou, ta liste WhatsApp…) : chaque ligne crée le compte, donne l’accès au produit
          et peut envoyer l’e-mail « Ton accès est prêt » avec son lien de connexion.
        </p>
      </div>
      <Notice>
        Colonnes acceptées (avec ou sans en-tête, séparées par « , » ou « ; ») : <strong>nom, e-mail, téléphone, produit</strong>.
        Le produit peut être son identifiant (ex. ma-formation) ou son titre ; vide = le produit choisi ci-dessous.
      </Notice>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()) }} />
        <Button variant="secondary" onClick={() => file.current?.click()}>Choisir un fichier CSV</Button>
        <span className="text-sm text-gray-500">ou colle les lignes ci-dessous</span>
      </div>
      <textarea className={`${inputClass} font-mono`} rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'nom,email,telephone,produit\nJean Mbarga,jean@exemple.com,+237600000000,motion-design-ia'} />
      <div className="flex flex-wrap items-center gap-4">
        <Select className="w-80" value={productId} onChange={setProductId} placeholder="Produit par défaut (si la colonne est vide)" options={products.map((p) => ({ value: p.id, label: p.title }))} />
        <Checkbox checked={notify} onChange={setNotify} label="Envoyer l’e-mail d’accès à chaque client" />
      </div>
      {error && <Notice tone="red">{error}</Notice>}
      <div className="flex gap-3">
        <Button variant="secondary" disabled={busy || !csv.trim()} onClick={() => run(true)} className="rounded-full">Vérifier sans importer</Button>
        <Button disabled={busy || !csv.trim()} onClick={() => run(false)} className="rounded-full px-6">{busy ? 'Import en cours…' : 'Importer'}</Button>
      </div>
      {result && (
        <section className="space-y-3">
          <Notice tone="green">
            {result.dryRun ? `Vérification : ${result.report.filter((r) => r.ok).length} ligne(s) prête(s) sur ${result.total}.` : `${result.granted} accès donné(s), ${result.created} compte(s) créé(s), sur ${result.total} ligne(s).`}
          </Notice>
          <ul className="max-h-96 divide-y divide-gray-200 overflow-auto rounded-2xl border border-gray-200 bg-surface text-sm">
            {result.report.map((r) => (
              <li key={`${r.line}-${r.email}`} className="flex gap-3 p-2.5">
                <span className="w-10 text-gray-500">L{r.line}</span>
                <span className="w-64 truncate">{r.email}</span>
                <span className={r.ok ? 'text-green-700' : 'text-red-700'}>{r.result}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
