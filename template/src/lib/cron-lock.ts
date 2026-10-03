import { createClient } from '@supabase/supabase-js'

const STALE_AFTER_MS = 10 * 60 * 1000 // un verrou plus vieux que 10 min vient d'un passage planté

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Empêche une tâche planifiée de se chevaucher elle-même. true = verrou obtenu (appeler ensuite releaseCronLock). */
export async function acquireCronLock(name: string): Promise<boolean> {
  const db = serviceClient()
  const { error } = await db.from('cron_locks').insert({ name, locked_at: new Date().toISOString() })
  if (!error) return true

  const { data: existing } = await db.from('cron_locks').select('locked_at').eq('name', name).maybeSingle()
  if (!existing || Date.now() - new Date(existing.locked_at).getTime() < STALE_AFTER_MS) return false

  const { error: updateError } = await db
    .from('cron_locks')
    .update({ locked_at: new Date().toISOString() })
    .eq('name', name)
    .lt('locked_at', new Date(Date.now() - STALE_AFTER_MS).toISOString())
  return !updateError
}

export async function releaseCronLock(name: string): Promise<void> {
  try {
    // Supabase ne lève pas d'exception : on lit l'erreur, sinon un verrou bloqué passerait inaperçu jusqu'à son expiration.
    const { error } = await serviceClient().from('cron_locks').delete().eq('name', name)
    if (error) throw error
  } catch (error) {
    console.error('Verrou non libéré :', name, error)
  }
}
