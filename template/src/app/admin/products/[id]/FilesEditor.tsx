'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/dialog'
import { Notice, api, inputClass, uploadToStorage } from '@/components/admin/kit'

export type AdminFile = { id: string; title: string; storage_path: string; size_bytes: number | null; position: number }

// Fichiers à télécharger (kit d'exercices, zip…) : stockage privé, lien de téléchargement d'une minute pour les acheteurs.
export function FilesEditor({ productId, files, onChange }: { productId: string; files: AdminFile[]; onChange: () => void }) {
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()

  const upload = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    setProgress(0)
    try {
      const path = await uploadToStorage('files', productId, file, setProgress)
      const d = await api('/api/admin/files', 'POST', { product_id: productId, title: title.trim() || file.name, storage_path: path, size_bytes: file.size, position: (files.at(-1)?.position ?? 0) + 10 })
      if (!d.success) throw new Error(d.message || 'Enregistrement impossible.')
      setTitle('')
      setMessage({ tone: 'green', text: 'Fichier ajouté.' })
      onChange()
    } catch (error) {
      setMessage({ tone: 'red', text: (error as Error).message })
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (f: AdminFile) => {
    if (!(await confirm({ title: `Supprimer « ${f.title} » ?`, confirmLabel: 'Supprimer', danger: true }))) return
    const d = await api(`/api/admin/files/${f.id}`, 'DELETE')
    setMessage(d.success ? { tone: 'green', text: 'Fichier supprimé.' } : { tone: 'red', text: d.message || 'Erreur.' })
    onChange()
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
      <h2 className="text-xl">Fichiers à télécharger</h2>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {files.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="flex-1">{f.title}</span>
              <span className="text-xs text-gray-500">{f.size_bytes ? `${(f.size_bytes / 1024 / 1024).toFixed(1)} Mo` : ''}</span>
              <button type="button" onClick={() => remove(f)} className="text-red-700 underline">Supprimer</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-sm`} placeholder="Nom affiché (ex. Kit d'exercices)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input ref={input} type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="secondary" disabled={progress !== null} onClick={() => input.current?.click()}>{progress !== null ? `Envoi… ${progress} %` : 'Ajouter un fichier'}</Button>
      </div>
    </section>
  )
}
