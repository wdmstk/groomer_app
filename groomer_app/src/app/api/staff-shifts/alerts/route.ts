import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { parseDateKey } from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

export async function GET(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin', 'staff'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const db = toAnyClient(auth.supabase)

  const url = new URL(request.url)
  const date = parseDateKey(url.searchParams.get('date'))

  let query = db
    .from('shift_alerts')
    .select('id, alert_date, alert_type, severity, staff_id, appointment_id, message, resolved_at, created_at')
    .eq('store_id', auth.storeId)
    .is('resolved_at', null)
    .order('alert_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (date) query = query.eq('alert_date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: { alerts: data ?? [] } })
}
