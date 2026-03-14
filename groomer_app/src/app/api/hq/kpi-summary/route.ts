import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStoreIdsByHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'

type HqDailyMetricRow = {
  store_id: string
  metric_date_jst: string
  appointments_count: number | null
  completed_count: number | null
  canceled_count: number | null
  sales_amount: number | null
}

function getJstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function clampDate(value: string | null, fallback: string) {
  if (!value) return fallback
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  return value
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'ログインが必要です。' }, { status: 401 })
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
  if (membershipsError) {
    return NextResponse.json({ message: membershipsError.message }, { status: 500 })
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const candidateStoreIds = getStoreIdsByHqCapability(memberships, 'hq_view')
  if (candidateStoreIds.length === 0) {
    return NextResponse.json(
      { message: 'Proプランの owner/admin 所属店舗がありません。' },
      { status: 403 }
    )
  }
  const { data: subscriptionRows } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code')
    .in('store_id', candidateStoreIds)
  const storeIds = (subscriptionRows ?? [])
    .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code as string | null), 'pro'))
    .map((row) => row.store_id as string)
  if (storeIds.length === 0) {
    return NextResponse.json(
      { message: 'Proプランの owner/admin 所属店舗がありません。' },
      { status: 403 }
    )
  }

  const url = new URL(request.url)
  const toDefault = getJstDateKey()
  const fromDefault = getJstDateKey(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))
  const from = clampDate(url.searchParams.get('from'), fromDefault)
  const to = clampDate(url.searchParams.get('to'), toDefault)

  const { data: metricsData, error: metricsError } = await supabase
    .from('hq_store_daily_metrics_v1')
    .select('store_id, metric_date_jst, appointments_count, completed_count, canceled_count, sales_amount')
    .in('store_id', storeIds)
    .gte('metric_date_jst', from)
    .lte('metric_date_jst', to)
  if (metricsError) {
    return NextResponse.json({ message: metricsError.message }, { status: 500 })
  }

  const { data: storesData } = await supabase.from('stores').select('id, name').in('id', storeIds)
  const storeNameById = new Map((storesData ?? []).map((row) => [row.id as string, (row.name as string | null) ?? '店舗名未設定']))

  const perStore = new Map<
    string,
    {
      store_id: string
      store_name: string
      appointments_count: number
      completed_count: number
      canceled_count: number
      sales_amount: number
    }
  >()
  for (const storeId of storeIds) {
    perStore.set(storeId, {
      store_id: storeId,
      store_name: storeNameById.get(storeId) ?? '店舗名未設定',
      appointments_count: 0,
      completed_count: 0,
      canceled_count: 0,
      sales_amount: 0,
    })
  }

  for (const row of (metricsData ?? []) as HqDailyMetricRow[]) {
    const current = perStore.get(row.store_id)
    if (!current) continue
    current.appointments_count += Number(row.appointments_count ?? 0)
    current.completed_count += Number(row.completed_count ?? 0)
    current.canceled_count += Number(row.canceled_count ?? 0)
    current.sales_amount += Number(row.sales_amount ?? 0)
  }

  const stores = Array.from(perStore.values())
    .map((row) => ({
      ...row,
      completion_rate:
        row.appointments_count > 0
          ? Math.round((row.completed_count / row.appointments_count) * 1000) / 10
          : 0,
      cancel_rate:
        row.appointments_count > 0
          ? Math.round((row.canceled_count / row.appointments_count) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.sales_amount - a.sales_amount)

  const totals = stores.reduce(
    (acc, row) => {
      acc.appointments_count += row.appointments_count
      acc.completed_count += row.completed_count
      acc.canceled_count += row.canceled_count
      acc.sales_amount += row.sales_amount
      return acc
    },
    {
      appointments_count: 0,
      completed_count: 0,
      canceled_count: 0,
      sales_amount: 0,
    }
  )

  return NextResponse.json({
    from,
    to,
    stores,
    totals,
  })
}
