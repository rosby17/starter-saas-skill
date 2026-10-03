import { createClient } from '@supabase/supabase-js'

// Client « service » (contourne la RLS) : réservé aux routes serveur déjà protégées (requireAdmin, secret de cron, webhook signé).
export const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
