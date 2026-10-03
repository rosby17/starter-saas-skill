'use client'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-8 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover print:hidden">
      Imprimer / enregistrer en PDF
    </button>
  )
}
