import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject } from '@/lib/object-utils'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  return value === '1' || value === 'true' || value === 'on'
}

function parseFrequency(value: unknown) {
  if (value === 'daily' || value === 'weekly') return value
  return null
}

function parseMode(value: unknown) {
  if (value === 'apply_draft') return value
  return 'apply_draft'
}

function parseRunWeekday(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 6) return null
  return n
}

function parseHorizon(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const v = Math.trunc(n)
  if (v < 1 || v > 90) return null
  return v
}

function parseTime(value: unknown) {
  const text = `${value ?? ''}`.trim()
  if (!/^\d{2}:\d{2}$/.test(text)) return null
  return text
}

export async function GET() {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'pro',
    featureLabel: '定期シフト自動運転',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const db = toAnyClient(auth.supabase)
  const result = await db
    .from('shift_scheduled_jobs')
    .select('id, created_at, updated_at, is_active, frequency, run_at_local_time, run_weekday, target_horizon_days, mode')
    .eq('store_id', auth.storeId)
    .order('updated_at', { ascending: false })

  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: result.data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'pro',
    featureLabel: '定期シフト自動運転',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const contentType = request.headers.get('content-type') ?? ''
  let body: {
    frequency?: unknown
    run_at_local_time?: unknown
    run_weekday?: unknown
    target_horizon_days?: unknown
    mode?: unknown
    is_active?: unknown
  } = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    body = asObject(await request.json())
  } else {
    const formData = await request.formData()
    body = {
      frequency: formData.get('frequency')?.toString() ?? '',
      run_at_local_time: formData.get('run_at_local_time')?.toString() ?? '',
      run_weekday: formData.get('run_weekday')?.toString() ?? '',
      target_horizon_days: formData.get('target_horizon_days')?.toString() ?? '',
      mode: formData.get('mode')?.toString() ?? '',
      is_active: formData.get('is_active')?.toString() ?? '',
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }
  const frequency = parseFrequency(body.frequency)
  const runAtLocalTime = parseTime(body.run_at_local_time)
  const runWeekday = parseRunWeekday(body.run_weekday)
  const targetHorizonDays = parseHorizon(body.target_horizon_days)
  const mode = parseMode(body.mode)
  const isActive = parseBoolean(body.is_active, true)

  if (!frequency) return NextResponse.json({ message: 'frequency は daily/weekly を指定してください。' }, { status: 400 })
  if (!runAtLocalTime) return NextResponse.json({ message: 'run_at_local_time は HH:MM 形式で指定してください。' }, { status: 400 })
  if (targetHorizonDays == null) return NextResponse.json({ message: 'target_horizon_days は1-90で指定してください。' }, { status: 400 })
  if (frequency === 'weekly' && runWeekday == null) {
    return NextResponse.json({ message: 'weekly の場合 run_weekday は必須です。' }, { status: 400 })
  }
  if (frequency === 'daily' && runWeekday != null) {
    return NextResponse.json({ message: 'daily の場合 run_weekday は指定できません。' }, { status: 400 })
  }

  const db = toAnyClient(auth.supabase)
  const insertResult = await db
    .from('shift_scheduled_jobs')
    .insert({
      store_id: auth.storeId,
      is_active: isActive,
      frequency,
      run_at_local_time: runAtLocalTime,
      run_weekday: frequency === 'weekly' ? runWeekday : null,
      target_horizon_days: targetHorizonDays,
      mode,
      created_by_user_id: auth.user.id,
      updated_by_user_id: auth.user.id,
    })
    .select('id, is_active, frequency, run_at_local_time, run_weekday, target_horizon_days, mode, created_at, updated_at')
    .maybeSingle()

  if (insertResult.error) return NextResponse.json({ message: insertResult.error.message }, { status: 500 })
  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true, data: insertResult.data })
}
