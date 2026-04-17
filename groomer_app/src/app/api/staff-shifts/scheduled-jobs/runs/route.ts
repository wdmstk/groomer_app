import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { parseDateKey } from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

export async function GET(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'pro',
    featureLabel: '定期シフト自動運転',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const url = new URL(request.url)
  const fromDate = parseDateKey(url.searchParams.get('from'))
  const toDate = parseDateKey(url.searchParams.get('to'))

  const db = toAnyClient(auth.supabase)
  let query = db
    .from('shift_scheduled_job_runs')
    .select('id, job_id, status, started_at, finished_at, run_id, error_summary, created_at')
    .eq('store_id', auth.storeId)
    .order('started_at', { ascending: false })
    .limit(200)

  if (fromDate) query = query.gte('started_at', `${fromDate}T00:00:00+09:00`)
  if (toDate) query = query.lte('started_at', `${toDate}T23:59:59+09:00`)

  const result = await query
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: result.data ?? [] })
}
