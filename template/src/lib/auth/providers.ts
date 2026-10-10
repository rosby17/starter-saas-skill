// Fournisseurs de connexion activés sur la base (Supabase) : lu sur /auth/v1/settings, gardé une minute.
let cache: { at: number; google: boolean } | null = null

export async function googleEnabled(): Promise<boolean> {
  // « Activé » est gardé une minute ; « pas activé » seulement 10 s, pour que le bouton apparaisse vite après l'activation.
  if (cache && Date.now() - cache.at < (cache.google ? 60_000 : 10_000)) return cache.google
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let google = false
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(3000) })
      if (res.ok) google = !!(await res.json())?.external?.google
    } catch { /* base injoignable : pas de bouton Google */ }
  }
  cache = { at: Date.now(), google }
  return google
}
