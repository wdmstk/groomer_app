import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
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

function parseRunWeekday(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 6) return null
  return n
}

function parseHorizon(value: unknown) {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const v = Math.trunc(n)
  if (v < 1 || v > 90) return null
  return v
}

function parseTime(value: unknown) {
  if (value === undefined) return undefined
  const text = `${value ?? ''}`.trim()
  if (!/^\d{2}:\d{2}$/.test(text)) return null
  return text
}

async function updateJob(params: {
  context: { params: Promise<{ job_id: string }> }
  body: UnknownObject
}) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'pro',
    featureLabel: '定期シフト自動運転',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { job_id: jobId } = await params.context.params
  if (!jobId) return NextResponse.json({ message: 'job_id が不正です。' }, { status: 400 })

  const body = params.body
  const frequency = parseFrequency(body.frequency)
  const runAtLocalTime = parseTime(body.run_at_local_time)
  const runWeekday = parseRunWeekday(body.run_weekday)
  const targetHorizonDays = parseHorizon(body.target_horizon_days)

  if (body.frequency !== undefined && !frequency) {
    return NextResponse.json({ message: 'frequency は daily/weekly を指定してください。' }, { status: 400 })
  }
  if (runAtLocalTime === null) {
    return NextResponse.json({ message: 'run_at_local_time は HH:MM 形式で指定してください。' }, { status: 400 })
  }
  if (targetHorizonDays === null) {
    return NextResponse.json({ message: 'target_horizon_days は1-90で指定してください。' }, { status: 400 })
  }

  const db = toAnyClient(auth.supabase)
  const existingResult = await db
    .from('shift_scheduled_jobs')
    .select('id, frequency, run_weekday')
    .eq('store_id', auth.storeId)
    .eq('id', jobId)
    .maybeSingle()
  if (existingResult.error) return NextResponse.json({ message: existingResult.error.message }, { status: 500 })
  if (!existingResult.data) return NextResponse.json({ message: '対象ジョブが見つかりません。' }, { status: 404 })

  const effectiveFrequency = frequency ?? existingResult.data.frequency
  const effectiveRunWeekday = body.run_weekday === undefined ? existingResult.data.run_weekday : runWeekday
  if (effectiveFrequency === 'weekly' && effectiveRunWeekday == null) {
    return NextResponse.json({ message: 'weekly の場合 run_weekday は必須です。' }, { status: 400 })
  }
  if (effectiveFrequency === 'daily' && effectiveRunWeekday != null) {
    return NextResponse.json({ message: 'daily の場合 run_weekday は指定できません。' }, { status: 400 })
  }

  const patch: UnknownObject = {
    updated_at: new Date().toISOString(),
    updated_by_user_id: auth.user.id,
  }
  if (body.is_active !== undefined) patch.is_active = parseBoolean(body.is_active, true)
  if (frequency) patch.frequency = frequency
  if (runAtLocalTime !== undefined) patch.run_at_local_time = runAtLocalTime
  if (body.run_weekday !== undefined) patch.run_weekday = runWeekday
  if (targetHorizonDays !== undefined) patch.target_horizon_days = targetHorizonDays
  if (body.mode === 'apply_draft') patch.mode = 'apply_draft'
  if (effectiveFrequency === 'daily') patch.run_weekday = null

  const updateResult = await db
    .from('shift_scheduled_jobs')
    .update(patch)
    .eq('store_id', auth.storeId)
    .eq('id', jobId)
    .select('id, is_active, frequency, run_at_local_time, run_weekday, target_horizon_days, mode, created_at, updated_at')
    .maybeSingle()

  if (updateResult.error) return NextResponse.json({ message: updateResult.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: updateResult.data })
}

async function deleteJob(params: { context: { params: Promise<{ job_id: string }> } }) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'pro',
    featureLabel: '定期シフト自動運転',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { job_id: jobId } = await params.context.params
  if (!jobId) return NextResponse.json({ message: 'job_id が不正です。' }, { status: 400 })

  const db = toAnyClient(auth.supabase)
  const deleteResult = await db.from('shift_scheduled_jobs').delete().eq('store_id', auth.storeId).eq('id', jobId)
  if (deleteResult.error) return NextResponse.json({ message: deleteResult.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request, context: { params: Promise<{ job_id: string }> }) {
  return updateJob({ context, body: asObject(await request.json()) })
}

export async function DELETE(_request: Request, context: { params: Promise<{ job_id: string }> }) {
  return deleteJob({ context })
}

export async function POST(request: Request, context: { params: Promise<{ job_id: string }> }) {
  const formData = await request.formData()
  const method = (formData.get('_method')?.toString() ?? 'patch').toLowerCase()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const body: UnknownObject = {
    is_active: formData.get('is_active')?.toString() ?? '',
    frequency: formData.get('frequency')?.toString() ?? '',
    run_at_local_time: formData.get('run_at_local_time')?.toString() ?? '',
    run_weekday: formData.get('run_weekday')?.toString() ?? '',
    target_horizon_days: formData.get('target_horizon_days')?.toString() ?? '',
    mode: formData.get('mode')?.toString() ?? '',
  }
  if (method === 'delete') {
    const result = await deleteJob({ context })
    if (redirectTo && result.status < 400) return NextResponse.redirect(new URL(redirectTo, request.url))
    return result
  }
  const result = await updateJob({ context, body })
  if (redirectTo && result.status < 400) return NextResponse.redirect(new URL(redirectTo, request.url))
  return result
}
