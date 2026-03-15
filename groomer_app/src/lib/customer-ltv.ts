import type { Database } from '@/lib/supabase/database.types'

export type CustomerLtvSummaryRow = Database['public']['Views']['customer_ltv_summary_v']['Row']

export function getCustomerLtvRankTone(rank: string | null | undefined) {
  switch (rank) {
    case 'S':
      return 'bg-amber-100 text-amber-900'
    case 'A':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function getCustomerLtvRankLabel(rank: string | null | undefined) {
  switch (rank) {
    case 'S':
      return 'S'
    case 'A':
      return 'A'
    default:
      return 'B'
  }
}

export async function fetchCustomerLtvSummaries(params: {
  supabase: {
    from: (table: 'customer_ltv_summary_v') => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options?: { ascending?: boolean | undefined }
          ) => Promise<{ data: CustomerLtvSummaryRow[] | null; error: { message: string } | null }>
        }
      }
    }
  }
  storeId: string
}) {
  const { data, error } = await params.supabase
    .from('customer_ltv_summary_v')
    .select('store_id, customer_id, annual_sales, visit_count, average_spend, option_usage_rate, ltv_rank, last_paid_at')
    .eq('store_id', params.storeId)
    .order('annual_sales', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
