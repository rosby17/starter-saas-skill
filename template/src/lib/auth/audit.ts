import type { SupabaseClient } from '@supabase/supabase-js'

// Toute action admin sensible laisse une trace : qui, quoi, sur quoi, quand (table admin_audit_log).
export async function logAdminAction(
  db: SupabaseClient,
  adminId: string,
  action: string,
  target: { type: string; id: string },
  details: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await db.from('admin_audit_log').insert({ admin_id: adminId, action, target_type: target.type, target_id: target.id, details })
  if (error) console.error("Journal d'audit non écrit :", action, target, error)
}
