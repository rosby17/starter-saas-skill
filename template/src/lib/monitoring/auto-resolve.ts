import { serviceClient } from '@/lib/auth/service-client'
import { explainError } from '@/lib/monitoring/explain-error'

// Le journal ne doit jamais grossir ni alarmer pour rien :
//  - erreurs sans suite (client, fournisseur, proxy) : classées après 24 h ;
//  - vrais problèmes : résolus après 24 h SANS récidive (si ça revient, une nouvelle ligne s'ouvre) ;
//  - erreurs fermées depuis plus de 30 jours : supprimées.
const HOURS = 24
const RETENTION_DAYS = 30
const THROTTLE_MS = 10 * 60 * 1000
let lastRun = 0

export async function autoResolveStaleErrors() {
  if (Date.now() - lastRun < THROTTLE_MS) return
  lastRun = Date.now()
  try {
    const supabase = serviceClient()
    const { data } = await supabase
      .from('error_logs')
      .select('id, source, action, http_status, error_message, details')
      .is('resolved_at', null)
      .lt('created_at', new Date(Date.now() - HOURS * 3600 * 1000).toISOString())
      .limit(2000)
    const ids = (data || []).map((row) => row.id)
    const lowIds = new Set((data || []).filter((row) => explainError(row).severity === 'low').map((row) => row.id))
    const now = new Date().toISOString()
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200)
      const note = (id: string) => (lowIds.has(id) ? `Classée automatiquement : sans suite après ${HOURS} h.` : `Résolue automatiquement : aucune récidive depuis ${HOURS} h.`)
      await Promise.all(slice.map((id) => supabase.from('error_logs').update({ resolved_at: now, resolution_note: note(id) }).eq('id', id).is('resolved_at', null)))
    }
    await supabase.from('error_logs').delete().not('resolved_at', 'is', null).lt('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString())
  } catch (error) {
    console.error('[auto-resolve] échec', error)
  }
}
