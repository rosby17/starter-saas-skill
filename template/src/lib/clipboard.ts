// Copie dans le presse-papiers qui ne lève jamais d'exception (appris sur iziVoice, 17/10/2026).
//
// `navigator.clipboard.writeText` est refusé dans certains navigateurs ou applications (fenêtre intégrée,
// iframe, autorisation refusée, page non sécurisée). Appelé sans `await`/`catch`, ce refus remonte en erreur
// JavaScript non gérée. On tente l'API moderne, puis l'ancienne méthode (execCommand) ; le résultat dit si la
// copie a vraiment réussi, pour n'afficher « Copié » que dans ce cas (sinon : « sélectionne et copie à la main »).
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Refusé : on essaie l'ancienne méthode ci-dessous.
  }
  try {
    if (typeof document === 'undefined') return false
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
