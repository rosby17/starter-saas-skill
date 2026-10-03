'use client'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-8 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white print:hidden">
      Imprimer / enregistrer en PDF
    </button>
  )
}
