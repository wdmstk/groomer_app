import type { Database } from '@/lib/supabase/database.types'

export type CustomerLtvSummaryRow = Database['public']['Views']['customer_ltv_summary_v']['Row']
export type CustomerLtvSummaryReader = {
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

export function getCustomerLtvRankTone(rank: string | null | undefined) {
  switch (rank) {
    case 'ゴールド':
      return 'bg-amber-100 text-amber-900'
    case 'シルバー':
      return 'bg-slate-100 text-slate-700'
    case 'ブロンズ':
      return 'bg-orange-100 text-orange-900'
    default:
      return 'bg-sky-100 text-sky-800'
  }
}

export function getCustomerLtvRankLabel(rank: string | null | undefined) {
  switch (rank) {
    case 'ゴールド':
      return 'ゴールド'
    case 'シルバー':
      return 'シルバー'
    case 'ブロンズ':
      return 'ブロンズ'
    default:
      return 'スタンダード'
  }
}

export async function fetchCustomerLtvSummaries(params: {
  supabase: CustomerLtvSummaryReader
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
