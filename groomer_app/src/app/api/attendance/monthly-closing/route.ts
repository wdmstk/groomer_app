import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, type UnknownObject } from '@/lib/object-utils'

function parseMonth(value: string) {
  const candidate = value.trim()
  if (/^\d{4}-\d{2}$/.test(candidate)) return candidate
  return null
}

export async function POST(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })

  const contentType = request.headers.get('content-type') ?? ''
  let body: UnknownObject = {}
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    body = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    body = {
      target_month: formData.get('target_month')?.toString() ?? '',
    }
  }
  const targetMonth = parseMonth(String(body.target_month ?? ''))
  if (!targetMonth) return NextResponse.json({ message: 'target_month は YYYY-MM 形式で指定してください。' }, { status: 400 })

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('attendance_monthly_closings')
    .upsert(
      {
        store_id: auth.storeId,
        target_month: targetMonth,
        status: 'closed',
        closed_by_user_id: auth.user.id,
        closed_at: now,
      },
      { onConflict: 'store_id,target_month' }
    )
    .select('id, target_month, status, closed_by_user_id, closed_at, reopened_by_user_id, reopened_at')
    .single()
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
