import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Garde des PAGES de l'administration (leçon de l'audit Ballon Viral, 07/11/2026). Next.js ne réexécute pas le layout lors d'une
 * navigation interne : une requête fabriquée peut recevoir une page sans passer par la vérification du layout.
 * Chaque page serveur de /admin appelle donc cette fonction elle-même. `cache` : une seule lecture par requête,
 * partagée avec le layout.
 */
export const requireAdminPage = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) redirect('/dashboard')
  return { user, profile }
})
