// Types de l'écran du coach (copie côté navigateur des formes renvoyées par /api/admin/coach/*).
import type { CoachContact } from '@/lib/coach/contacts'
import type { DailyAction, DailyBrief, StoredDaily } from '@/lib/coach/daily'
import type { ClientReply } from '@/lib/coach/replies'

export type { CoachContact, DailyAction, DailyBrief, StoredDaily, ClientReply }

export type CoachState = {
  configured: boolean
  daily: StoredDaily | null
  contacts: Record<string, CoachContact[]>
  offerLink: string
  stale: boolean
  generating: boolean
  failure: string | null
}
