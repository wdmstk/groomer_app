import type { createStoreScopedClient } from '@/lib/supabase/store'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'

export class PaymentServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PaymentServiceError'
    this.status = status
  }
}

export type PaymentSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export type AppointmentMenu = {
  menu_id: string
  menu_name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
}

export type PaymentWriteInput = {
  appointmentId: string | null
  customerId: string | null
  method: string | null
  discountAmount: number
  notes: string | null
  idempotencyKey?: string | null
}

export const PAYMENT_SELECT_COLUMNS =
  'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, idempotency_key'

export function calculatePaymentTotals(menus: AppointmentMenu[]) {
  return menus.reduce(
    (acc, menu) => {
      const taxRate = menu.tax_rate ?? 0.1
      const taxIncluded = menu.tax_included ?? true
      const base = taxIncluded ? menu.price / (1 + taxRate) : menu.price
      const tax = taxIncluded ? menu.price - base : menu.price * taxRate

      acc.subtotal += base
      acc.tax += tax
      acc.total += base + tax
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 }
  )
}

export function validatePaymentWriteInput(input: PaymentWriteInput) {
  if (!input.appointmentId) {
    throw new PaymentServiceError('予約の選択は必須です。')
  }
}

export function isDuplicatePaymentError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  if (error.code === '23505') return true
  return error.message?.includes('duplicate key') ?? false
}

export async function findPaymentByAppointment(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT_COLUMNS)
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  return data
}

export async function findPaymentByIdempotencyKey(
  supabase: PaymentSupabaseClient,
  storeId: string,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT_COLUMNS)
    .eq('store_id', storeId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  return data
}

export async function ensureAppointmentHasNoOtherPayment(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string,
  excludePaymentId?: string
) {
  let query = supabase
    .from('payments')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (excludePaymentId) {
    query = query.neq('id', excludePaymentId)
  }

  const { data, error } = await query.limit(1)
  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  if ((data ?? []).length > 0) {
    throw new PaymentServiceError('この予約にはすでに会計が登録されています。二重会計はできません。', 409)
  }
}

export async function findVisitByAppointment(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const { data, error } = await supabase
    .from('visits')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  return data
}

export async function reconcilePaymentVisitLink(
  supabase: PaymentSupabaseClient,
  storeId: string,
  paymentId: string,
  visitId: string
) {
  const { error } = await supabase
    .from('payments')
    .update({ visit_id: visitId })
    .eq('id', paymentId)
    .eq('store_id', storeId)

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }
}

async function ensureVisitMenus(
  supabase: PaymentSupabaseClient,
  storeId: string,
  visitId: string,
  menus: AppointmentMenu[]
) {
  const { data: existingRows, error: existingError } = await supabase
    .from('visit_menus')
    .select('menu_id, menu_name, price, duration, tax_rate, tax_included')
    .eq('store_id', storeId)
    .eq('visit_id', visitId)

  if (existingError) {
    throw new PaymentServiceError(existingError.message, 500)
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) =>
      JSON.stringify([
        row.menu_id,
        row.menu_name,
        row.price,
        row.duration,
        row.tax_rate ?? 0.1,
        row.tax_included ?? true,
      ])
    )
  )

  const visitMenuPayload = menus
    .map((menu) => ({
      store_id: storeId,
      visit_id: visitId,
      menu_id: menu.menu_id,
      menu_name: menu.menu_name,
      price: menu.price,
      duration: menu.duration,
      tax_rate: menu.tax_rate ?? 0.1,
      tax_included: menu.tax_included ?? true,
    }))
    .filter((menu) => {
      const key = JSON.stringify([
        menu.menu_id,
        menu.menu_name,
        menu.price,
        menu.duration,
        menu.tax_rate,
        menu.tax_included,
      ])
      return !existingKeys.has(key)
    })

  if (visitMenuPayload.length === 0) return

  const { error: visitMenuError } = await supabase.from('visit_menus').insert(visitMenuPayload)
  if (visitMenuError) {
    throw new PaymentServiceError(visitMenuError.message, 500)
  }
}

export async function resolveCustomerForPayment(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string,
  requestedCustomerId: string | null
) {
  const { data: appointmentInfo, error: appointmentError } = await supabase
    .from('appointments')
    .select('customer_id')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (appointmentError) {
    throw new PaymentServiceError(appointmentError.message, 500)
  }

  const resolvedCustomerId = requestedCustomerId ?? appointmentInfo?.customer_id ?? null
  if (requestedCustomerId && appointmentInfo?.customer_id && requestedCustomerId !== appointmentInfo.customer_id) {
    throw new PaymentServiceError('予約と顧客の紐付けが不正です。')
  }

  if (!resolvedCustomerId) {
    throw new PaymentServiceError('顧客情報を解決できません。')
  }

  const { data: customerInStore } = await supabase
    .from('customers')
    .select('id')
    .eq('id', resolvedCustomerId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!customerInStore) {
    throw new PaymentServiceError('選択した顧客はこの店舗に存在しません。')
  }

  return {
    resolvedCustomerId,
    appointmentCustomerId: appointmentInfo?.customer_id ?? null,
  }
}

export async function fetchAppointmentMenus(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const { data: appointmentMenus, error } = await supabase
    .from('appointment_menus')
    .select('menu_id, menu_name, price, duration, tax_rate, tax_included')
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  const menus = (appointmentMenus ?? []) as AppointmentMenu[]
  if (menus.length === 0) {
    throw new PaymentServiceError('予約メニューが未登録です。')
  }

  return menus
}

export async function handlePaymentCompletion(
  supabase: PaymentSupabaseClient,
  storeId: string,
  appointmentId: string,
  paymentId: string,
  totalAmount: number,
  actorUserId?: string | null
) {
  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, customer_id, staff_id, start_time, menu')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (appointmentError) {
    throw new PaymentServiceError(appointmentError.message, 500)
  }
  if (!appointment) {
    throw new PaymentServiceError('対象予約が見つかりません。', 404)
  }

  const menus = await fetchAppointmentMenus(supabase, storeId, appointmentId)
  let visitId = (await findVisitByAppointment(supabase, storeId, appointmentId))?.id ?? null

  if (!visitId) {
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert({
        store_id: storeId,
        customer_id: appointment.customer_id,
        appointment_id: appointment.id,
        staff_id: appointment.staff_id,
        visit_date: appointment.start_time,
        menu: appointment.menu,
        total_amount: totalAmount,
        notes: '会計完了時に自動作成',
      })
      .select('id')
      .single()

    if (visitError) {
      if (!isDuplicatePaymentError(visitError)) {
        throw new PaymentServiceError(visitError.message, 500)
      }
      visitId = (await findVisitByAppointment(supabase, storeId, appointmentId))?.id ?? null
    } else {
      visitId = visit?.id ?? null
      if (visit) {
        await insertAuditLogBestEffort({
          supabase,
          storeId,
          actorUserId: actorUserId ?? null,
          entityType: 'visit',
          entityId: visit.id,
          action: 'created_auto_from_payment',
          after: {
            id: visit.id,
            appointment_id: appointment.id,
            customer_id: appointment.customer_id,
            staff_id: appointment.staff_id,
            visit_date: appointment.start_time,
            menu: appointment.menu,
            total_amount: totalAmount,
            notes: '会計完了時に自動作成',
          },
          payload: {
            payment_id: paymentId,
            source: 'payment_completion',
          },
        })
      }
    }
  }

  if (!visitId) {
    throw new PaymentServiceError('来店履歴の作成結果を解決できません。', 500)
  }

  await ensureVisitMenus(supabase, storeId, visitId, menus)
  await reconcilePaymentVisitLink(supabase, storeId, paymentId, visitId)
  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: actorUserId ?? null,
    entityType: 'payment',
    entityId: paymentId,
    action: 'visit_linked',
    after: {
      id: paymentId,
      visit_id: visitId,
      appointment_id: appointmentId,
    },
    payload: {
      visit_id: visitId,
      appointment_id: appointmentId,
    },
  })
}
