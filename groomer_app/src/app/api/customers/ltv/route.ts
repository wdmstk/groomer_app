import { NextResponse } from 'next/server'
import { fetchCustomerLtvSummaries } from '@/lib/customer-ltv'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()

  try {
    const rows = await fetchCustomerLtvSummaries({
      supabase,
      storeId,
    })
    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customer LTV summaries.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
