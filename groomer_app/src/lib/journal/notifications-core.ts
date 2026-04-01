export type JournalNotificationEnqueueResult =
  | { queued: true }
  | { queued: false; reason: string }

type CustomerLookupQuery = {
  eq: (column: string, value: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
    }
  }
}

type ExistingNotificationLookupQuery = {
  eq: (column: string, value: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          in: (column: string, values: string[]) => {
            limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
          }
        }
      }
    }
  }
}

interface NotificationSupabaseClient {
  from(table: 'customers'): {
    select: (columns: string) => CustomerLookupQuery
  }
  from(table: 'journal_notifications'): {
    select: (columns: string) => ExistingNotificationLookupQuery
    insert: (payload: unknown) => Promise<{ error: { message: string } | null }>
  }
}

export async function enqueueJournalLineNotificationCore(params: {
  supabase: NotificationSupabaseClient
  storeId: string
  entryId: string
  customerId: string
}): Promise<JournalNotificationEnqueueResult> {
  const { supabase, storeId, entryId, customerId } = params

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, line_id')
    .eq('store_id', storeId)
    .eq('id', customerId)
    .maybeSingle()

  const customerRow = (customer ?? null) as { id?: string; line_id?: string | null } | null
  if (customerError || !customerRow) {
    return { queued: false, reason: customerError?.message ?? 'customer_not_found' }
  }

  if (!customerRow.line_id) {
    return { queued: false, reason: 'line_id_not_found' }
  }

  const { data: existing } = await supabase
    .from('journal_notifications')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('entry_id', entryId)
    .eq('channel', 'line')
    .eq('recipient_customer_id', customerId)
    .in('status', ['queued', 'sent'])
    .limit(1)

  if ((existing ?? []).length > 0) {
    return { queued: false, reason: 'already_queued_or_sent' }
  }

  const { error: insertError } = await supabase.from('journal_notifications').insert({
    store_id: storeId,
    entry_id: entryId,
    channel: 'line',
    recipient_customer_id: customerId,
    status: 'queued',
  })

  if (insertError) {
    return { queued: false, reason: insertError.message }
  }

  return { queued: true }
}
