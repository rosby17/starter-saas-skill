// Pack de crédits recommandé à un client dont le solde est faible (« proposer directement le pack qu'il a l'habitude
// de prendre : c'est celui qu'il a le plus de chances d'acheter »). Fonction pure, testable sans base :
//   1. le pack qu'il achète le plus souvent (à égalité, le plus récent) sur 12 mois ;
//   2. sinon, le plus petit pack qui couvre sa consommation des 30 derniers jours ;
//   3. sinon, le pack d'entrée (le plus petit).

export type PackLike = { slug: string; credits: number }
export type Recommendation = { pack: string; reason: 'habit' | 'usage' | 'default' }

export const REASON_LABEL: Record<Recommendation['reason'], string> = {
  habit: 'Ton pack habituel',
  usage: 'Couvre ton mois de consommation',
  default: 'Pour commencer',
}

/** Pack du catalogue le plus proche d'un nombre de crédits achetés (écart relatif : 900 ≈ 1 000, pas 500). */
export function packForCredits<T extends PackLike>(credits: number, packs: readonly T[]): T | null {
  if (!(credits > 0) || !packs.length) return null
  let best = packs[0]
  for (const p of packs) if (Math.abs(Math.log(p.credits / credits)) < Math.abs(Math.log(best.credits / credits))) best = p
  return best
}

export function recommendPack<T extends PackLike>(input: { paidOrders: { credits: number; productSlug?: string | null; at: string }[]; spent30d: number }, packs: readonly T[]): Recommendation | null {
  const usable = packs.filter((p) => p.credits > 0)
  if (!usable.length) return null
  const counts = new Map<string, { n: number; last: number }>()
  for (const o of input.paidOrders) {
    // Le produit acheté s'il existe encore ; sinon le pack le plus proche du nombre de crédits reçus.
    const pack = usable.find((p) => p.slug === o.productSlug) ?? packForCredits(o.credits, usable)
    if (!pack) continue
    const at = Date.parse(o.at) || 0
    const e = counts.get(pack.slug) ?? { n: 0, last: 0 }
    counts.set(pack.slug, { n: e.n + 1, last: Math.max(e.last, at) })
  }
  const habit = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)[0]
  if (habit) return { pack: habit[0], reason: 'habit' }
  const sorted = [...usable].sort((a, b) => a.credits - b.credits)
  if (input.spent30d > 0) return { pack: (sorted.find((p) => p.credits >= input.spent30d) ?? sorted[sorted.length - 1]).slug, reason: 'usage' }
  return { pack: sorted[0].slug, reason: 'default' }
}

/** Le bandeau s'affiche seulement sous le seuil, hors période de pause (« Plus tard »). */
export function shouldShowNudge(balance: number | null, state: { threshold: number; snoozedUntil: string | null } | null, now = Date.now()): boolean {
  if (balance === null || !state) return false
  if (balance > state.threshold) return false
  return !state.snoozedUntil || Date.parse(state.snoozedUntil) <= now
}
