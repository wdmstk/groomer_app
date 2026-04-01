import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  enqueueJournalLineNotificationCore,
  type JournalNotificationEnqueueResult,
} from '@/lib/journal/notifications-core'

type StoreScopedSupabase = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export async function enqueueJournalLineNotification(params: {
  supabase: StoreScopedSupabase
  storeId: string
  entryId: string
  customerId: string
}): Promise<JournalNotificationEnqueueResult> {
  return enqueueJournalLineNotificationCore(params)
}
