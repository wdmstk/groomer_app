import {
  enqueueJournalLineNotificationCore,
  type JournalNotificationEnqueueResult,
  type NotificationSupabaseClient,
} from '@/lib/journal/notifications-core'

export async function enqueueJournalLineNotification(params: {
  supabase: NotificationSupabaseClient
  storeId: string
  entryId: string
  customerId: string
}): Promise<JournalNotificationEnqueueResult> {
  return enqueueJournalLineNotificationCore(params)
}
