'use client'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-100 print:hidden">
      Imprimer
    </button>
  )
}
