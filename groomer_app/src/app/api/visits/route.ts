import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

function toUtcIsoFromJstInput(value: string | null | undefined) {
  if (!value) return null
  const source = /Z|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}:00+09:00`
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function isDuplicateVisitError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  if (error.code === '23505') return true
  return error.message?.includes('duplicate key') ?? false
}

async function findVisitByAppointment(params: {
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
  storeId: string
  appointmentId: string
}) {
  const { supabase, storeId, appointmentId } = params
  const { data, error } = await supabase
    .from('visits')
    .select('id')
    .eq('store_id', storeId)
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('visits')
    .select(
      'id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes, customers(full_name), appointments(id, pets(name)), staffs(full_name), visit_menus(menu_name, price, duration)'
    )
    .eq('store_id', storeId)
    .order('visit_date', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const customerId = formData.get('customer_id')?.toString()
  const staffId = formData.get('staff_id')?.toString()
  const appointmentId = formData.get('appointment_id')?.toString()
  const visitDate = formData.get('visit_date')?.toString()
  const menu = formData.get('menu')?.toString().trim()
  const totalAmount = formData.get('total_amount')?.toString()

  if (!customerId) {
    return NextResponse.json({ message: '顧客の選択は必須です。' }, { status: 400 })
  }

  if (!staffId) {
    return NextResponse.json({ message: '担当スタッフの選択は必須です。' }, { status: 400 })
  }

  if (!visitDate) {
    return NextResponse.json({ message: '来店日時は必須です。' }, { status: 400 })
  }

  if (!menu) {
    return NextResponse.json({ message: '施術メニューは必須です。' }, { status: 400 })
  }

  if (!totalAmount) {
    return NextResponse.json({ message: '合計金額は必須です。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    customer_id: customerId,
    appointment_id: appointmentId || null,
    staff_id: staffId,
    visit_date: toUtcIsoFromJstInput(visitDate),
    menu,
    total_amount: Number(totalAmount),
    notes: formData.get('notes')?.toString() || null,
  }

  const checks = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase.from('staffs').select('id').eq('id', staffId).eq('store_id', storeId).maybeSingle(),
    appointmentId
      ? supabase
          .from('appointments')
          .select('id')
          .eq('id', appointmentId)
          .eq('store_id', storeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!checks[0].data || !checks[1].data || (appointmentId && !checks[2].data)) {
    return NextResponse.json({ message: '顧客・担当・予約の店舗整合性が不正です。' }, { status: 400 })
  }

  if (appointmentId) {
    const existingVisit = await findVisitByAppointment({ supabase, storeId, appointmentId })
    if (existingVisit.error) {
      return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
    }
    if (existingVisit.data) {
      return NextResponse.redirect(new URL(`/visits?tab=list&edit=${existingVisit.data.id}`, request.url))
    }
  }

  const { data, error } = await supabase
    .from('visits')
    .insert(payload)
    .select('id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes')
    .single()

  if (error) {
    if (appointmentId && isDuplicateVisitError(error)) {
      const existingVisit = await findVisitByAppointment({ supabase, storeId, appointmentId })
      if (existingVisit.error) {
        return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
      }
      if (existingVisit.data) {
        return NextResponse.redirect(new URL(`/visits?tab=list&edit=${existingVisit.data.id}`, request.url))
      }
    }
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (data) {
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'visit',
      entityId: data.id,
      action: 'created',
      after: data,
    })
  }

  return NextResponse.redirect(new URL(`/visits?tab=list&edit=${data?.id ?? ''}`, request.url))
}
