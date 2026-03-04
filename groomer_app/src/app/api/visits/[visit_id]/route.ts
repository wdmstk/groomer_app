import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    visit_id: string
  }>
}

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

async function findAnotherVisitByAppointment(params: {
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
  storeId: string
  appointmentId: string
  excludeVisitId: string
}) {
  const { supabase, storeId, appointmentId, excludeVisitId } = params
  const { data, error } = await supabase
    .from('visits')
    .select('id')
    .eq('store_id', storeId)
    .eq('appointment_id', appointmentId)
    .neq('id', excludeVisitId)
    .maybeSingle()

  return { data, error }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { visit_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('visits')
    .select(
      'id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes, visit_menus(menu_name, price, duration)'
    )
    .eq('id', visit_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { visit_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('visits')
    .select('id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes')
    .eq('id', visit_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const body = await request.json()
  const payload = {
    customer_id: body.customer_id ?? null,
    appointment_id: body.appointment_id ?? null,
    staff_id: body.staff_id ?? null,
    visit_date: toUtcIsoFromJstInput(body.visit_date),
    menu: body.menu ?? null,
    total_amount: body.total_amount ?? null,
    notes: body.notes ?? null,
  }

  if (!payload.customer_id) {
    return NextResponse.json({ message: '顧客の選択は必須です。' }, { status: 400 })
  }

  if (!payload.staff_id) {
    return NextResponse.json({ message: '担当スタッフの選択は必須です。' }, { status: 400 })
  }

  if (!payload.visit_date) {
    return NextResponse.json({ message: '来店日時は必須です。' }, { status: 400 })
  }

  if (!payload.menu) {
    return NextResponse.json({ message: '施術メニューは必須です。' }, { status: 400 })
  }

  if (!payload.total_amount) {
    return NextResponse.json({ message: '合計金額は必須です。' }, { status: 400 })
  }

  const checks = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .eq('id', payload.customer_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('staffs')
      .select('id')
      .eq('id', payload.staff_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    payload.appointment_id
      ? supabase
          .from('appointments')
          .select('id')
          .eq('id', payload.appointment_id)
          .eq('store_id', storeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!checks[0].data || !checks[1].data || (payload.appointment_id && !checks[2].data)) {
    return NextResponse.json({ message: '顧客・担当・予約の店舗整合性が不正です。' }, { status: 400 })
  }

  if (payload.appointment_id) {
    const existingVisit = await findAnotherVisitByAppointment({
      supabase,
      storeId,
      appointmentId: payload.appointment_id,
      excludeVisitId: visit_id,
    })
    if (existingVisit.error) {
      return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
    }
    if (existingVisit.data) {
      return NextResponse.json(
        { message: 'この予約にはすでに来店履歴が登録されています。', visit_id: existingVisit.data.id },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from('visits')
    .update({ ...payload, store_id: storeId })
    .eq('id', visit_id)
    .eq('store_id', storeId)
    .select(
      'id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes, visit_menus(menu_name, price, duration)'
    )
    .single()

  if (error) {
    if (payload.appointment_id && isDuplicateVisitError(error)) {
      const existingVisit = await findAnotherVisitByAppointment({
        supabase,
        storeId,
        appointmentId: payload.appointment_id,
        excludeVisitId: visit_id,
      })
      if (existingVisit.error) {
        return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
      }
      if (existingVisit.data) {
        return NextResponse.json(
          { message: 'この予約にはすでに来店履歴が登録されています。', visit_id: existingVisit.data.id },
          { status: 409 }
        )
      }
    }
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'visit',
    entityId: visit_id,
    action: 'updated',
    before,
    after: data,
  })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { visit_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('visits')
    .select('id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes')
    .eq('id', visit_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('visits')
    .delete()
    .eq('id', visit_id)
    .eq('store_id', storeId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (before) {
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'visit',
      entityId: visit_id,
      action: 'deleted',
      before,
    })
  }

  return NextResponse.json({ success: true })
}

async function deleteVisit(visitId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('visits')
    .select('id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes')
    .eq('id', visitId)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('visits')
    .delete()
    .eq('id', visitId)
    .eq('store_id', storeId)
  if (!error && before) {
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'visit',
      entityId: visitId,
      action: 'deleted',
      before,
    })
  }
  return { error }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { visit_id } = await context.params

  if (method === 'delete') {
    const { error } = await deleteVisit(visit_id)
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/visits?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('visits')
      .select('id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes')
      .eq('id', visit_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const payload = {
      customer_id: formData.get('customer_id')?.toString() || null,
      appointment_id: formData.get('appointment_id')?.toString() || null,
      staff_id: formData.get('staff_id')?.toString() || null,
      visit_date: toUtcIsoFromJstInput(formData.get('visit_date')?.toString() || null),
      menu: formData.get('menu')?.toString() || null,
      total_amount: formData.get('total_amount') ? Number(formData.get('total_amount')) : null,
      notes: formData.get('notes')?.toString() || null,
    }

    if (!payload.customer_id) {
      return NextResponse.json({ message: '顧客の選択は必須です。' }, { status: 400 })
    }

    if (!payload.staff_id) {
      return NextResponse.json({ message: '担当スタッフの選択は必須です。' }, { status: 400 })
    }

    if (!payload.visit_date) {
      return NextResponse.json({ message: '来店日時は必須です。' }, { status: 400 })
    }

    if (!payload.menu) {
      return NextResponse.json({ message: '施術メニューは必須です。' }, { status: 400 })
    }

    if (!payload.total_amount) {
      return NextResponse.json({ message: '合計金額は必須です。' }, { status: 400 })
    }

    const checks = await Promise.all([
      supabase
        .from('customers')
        .select('id')
        .eq('id', payload.customer_id)
        .eq('store_id', storeId)
        .maybeSingle(),
      supabase
        .from('staffs')
        .select('id')
        .eq('id', payload.staff_id)
        .eq('store_id', storeId)
        .maybeSingle(),
      payload.appointment_id
        ? supabase
            .from('appointments')
            .select('id')
            .eq('id', payload.appointment_id)
            .eq('store_id', storeId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (!checks[0].data || !checks[1].data || (payload.appointment_id && !checks[2].data)) {
      return NextResponse.json({ message: '顧客・担当・予約の店舗整合性が不正です。' }, { status: 400 })
    }

    if (payload.appointment_id) {
      const existingVisit = await findAnotherVisitByAppointment({
        supabase,
        storeId,
        appointmentId: payload.appointment_id,
        excludeVisitId: visit_id,
      })
      if (existingVisit.error) {
        return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
      }
      if (existingVisit.data) {
        return NextResponse.redirect(new URL(`/visits?tab=list&edit=${existingVisit.data.id}`, request.url))
      }
    }

    const { error } = await supabase
      .from('visits')
      .update({ ...payload, store_id: storeId })
      .eq('id', visit_id)
      .eq('store_id', storeId)

    if (error) {
      if (payload.appointment_id && isDuplicateVisitError(error)) {
        const existingVisit = await findAnotherVisitByAppointment({
          supabase,
          storeId,
          appointmentId: payload.appointment_id,
          excludeVisitId: visit_id,
        })
        if (existingVisit.error) {
          return NextResponse.json({ message: existingVisit.error.message }, { status: 500 })
        }
        if (existingVisit.data) {
          return NextResponse.redirect(new URL(`/visits?tab=list&edit=${existingVisit.data.id}`, request.url))
        }
      }
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'visit',
      entityId: visit_id,
      action: 'updated',
      before,
      after: {
        id: visit_id,
        ...payload,
      },
    })

    return NextResponse.redirect(new URL('/visits', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
