type SupabaseLike = {
  from: (table: string) => unknown
}

type MonthlyClosingQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { status?: string } | null; error: { message: string } | null }>
      }
    }
  }
}

export function monthKeyFromDateKey(dateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey.slice(0, 7) : null
}

export async function isAttendanceMonthClosed(args: {
  db: SupabaseLike
  storeId: string
  targetMonth: string | null
}) {
  const { db, storeId, targetMonth } = args
  if (!targetMonth) return { closed: false as const, message: null }
  try {
    const query = db.from('attendance_monthly_closings') as MonthlyClosingQuery
    const { data, error } = await query
      .select('status')
      .eq('store_id', storeId)
      .eq('target_month', targetMonth)
      .maybeSingle()
    if (error) {
      if (error.message.includes('attendance_monthly_closings')) return { closed: false as const, message: null }
      return { closed: false as const, message: error.message }
    }
    return { closed: data?.status === 'closed', message: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : '月次確定状態の取得に失敗しました。'
    if (message.includes('attendance_monthly_closings') || message.includes('Unexpected table')) {
      return { closed: false as const, message: null }
    }
    return { closed: false as const, message }
  }
}
