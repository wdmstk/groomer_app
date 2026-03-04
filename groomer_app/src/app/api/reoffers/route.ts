import { NextResponse } from 'next/server'
import type { Message } from '@line/bot-sdk'
import { sendLineMessage } from '@/lib/line'
import {
  getDefaultSlotReofferLineTemplate,
  renderSlotReofferLineTemplate,
} from '@/lib/reoffers/templates'
import { createStoreScopedClient } from '@/lib/supabase/store'

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

type AppointmentRow = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string
  end_time: string
  menu: string
  status: string | null
  notes: string | null
}

type CustomerRow = {
  id: string
  full_name: string
  phone_number: string | null
  line_id: string | null
  email?: string | null
}

type PetRow = {
  id: string
  customer_id: string
  name: string
  breed: string | null
}

type StaffRow = {
  id: string
  user_id: string | null
  full_name: string
}

type ReofferRow = {
  id: string
  appointment_id: string
  target_customer_id: string | null
  target_pet_id: string | null
  target_staff_id: string | null
  status: string
  sent_at: string | null
  accepted_at: string | null
  notes: string | null
}

type WaitlistRow = {
  id: string
  customer_id: string
  pet_id: string | null
  desired_from: string | null
  desired_to: string | null
  preferred_menu: string | null
  preferred_staff_id: string | null
  channel: string
  notes: string | null
  created_at: string
}

type NotificationLogRow = {
  id: string
  customer_id: string | null
  appointment_id: string | null
  slot_reoffer_id: string | null
  channel: string
  notification_type: string
  status: string
  subject: string | null
  sent_at: string
}

type ReofferLogRow = {
  id: string
  slot_reoffer_id: string | null
  appointment_id: string
  actor_user_id: string | null
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

function dedupeKeyForReoffer(params: {
  appointmentId: string
  customerId: string
  channel: string
  dateKey: string
}) {
  return ['slot_reoffer', params.appointmentId, params.customerId, params.channel, params.dateKey].join(':')
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const until = addDays(now, 2)

  const [
    { data: canceledAppointments, error: appointmentsError },
    { data: recentAppointments, error: recentAppointmentsError },
    { data: customers, error: customersError },
    { data: pets, error: petsError },
    { data: staffs, error: staffsError },
    { data: existingReoffers, error: reoffersError },
    { data: waitlistRequests, error: waitlistError },
    { data: notificationLogs, error: notificationLogsError },
    { data: reofferLogs, error: reofferLogsError },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, customer_id, pet_id, staff_id, start_time, end_time, menu, status, notes')
      .eq('store_id', storeId)
      .eq('status', 'キャンセル')
      .gte('start_time', now.toISOString())
      .lte('start_time', until.toISOString())
      .order('start_time', { ascending: true }),
    supabase
      .from('appointments')
      .select('id, customer_id, pet_id, staff_id, start_time, end_time, menu, status, notes')
      .eq('store_id', storeId)
      .order('start_time', { ascending: false })
      .limit(1000),
    supabase
      .from('customers')
      .select('id, full_name, phone_number, line_id, email')
      .eq('store_id', storeId)
      .order('full_name', { ascending: true }),
    supabase
      .from('pets')
      .select('id, customer_id, name, breed')
      .eq('store_id', storeId)
      .order('name', { ascending: true }),
    supabase
      .from('staffs')
      .select('id, user_id, full_name')
      .eq('store_id', storeId)
      .order('full_name', { ascending: true }),
    supabase
      .from('slot_reoffers')
      .select(
        'id, appointment_id, target_customer_id, target_pet_id, target_staff_id, status, sent_at, accepted_at, notes'
      )
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),
    supabase
      .from('slot_waitlist_requests')
      .select(
        'id, customer_id, pet_id, desired_from, desired_to, preferred_menu, preferred_staff_id, channel, notes, created_at'
      )
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('customer_notification_logs')
      .select(
        'id, customer_id, appointment_id, slot_reoffer_id, channel, notification_type, status, subject, sent_at'
      )
      .eq('store_id', storeId)
      .eq('notification_type', 'slot_reoffer')
      .order('sent_at', { ascending: false })
      .limit(50),
    supabase
      .from('slot_reoffer_logs')
      .select('id, slot_reoffer_id, appointment_id, actor_user_id, event_type, payload, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const firstError =
    appointmentsError ??
    recentAppointmentsError ??
    customersError ??
    petsError ??
    staffsError ??
    reoffersError ??
    waitlistError ??
    notificationLogsError ??
    reofferLogsError
  if (firstError) {
    return NextResponse.json({ message: firstError.message }, { status: 500 })
  }

  const customerRows = (customers ?? []) as CustomerRow[]
  const petRows = (pets ?? []) as PetRow[]
  const staffRows = (staffs ?? []) as StaffRow[]
  const recentAppointmentRows = (recentAppointments ?? []) as AppointmentRow[]
  const reofferRows = (existingReoffers ?? []) as ReofferRow[]
  const waitlistRows = (waitlistRequests ?? []) as WaitlistRow[]
  const notificationLogRows = (notificationLogs ?? []) as NotificationLogRow[]
  const reofferLogRows = (reofferLogs ?? []) as ReofferLogRow[]

  const customerById = new Map(customerRows.map((row) => [row.id, row]))
  const petById = new Map(petRows.map((row) => [row.id, row]))
  const staffById = new Map(staffRows.map((row) => [row.id, row]))
  const petsByCustomerId = new Map<string, PetRow[]>()
  petRows.forEach((pet) => {
    const list = petsByCustomerId.get(pet.customer_id) ?? []
    list.push(pet)
    petsByCustomerId.set(pet.customer_id, list)
  })

  const futureBookedCustomerIds = new Set(
    recentAppointmentRows
      .filter(
        (row) =>
          row.customer_id &&
          row.status !== 'キャンセル' &&
          row.status !== '無断キャンセル' &&
          new Date(row.start_time).getTime() > now.getTime()
      )
      .map((row) => row.customer_id as string)
  )
  const noShowCounts = recentAppointmentRows.reduce((acc, row) => {
    if (row.customer_id && row.status === '無断キャンセル') {
      acc[row.customer_id] = (acc[row.customer_id] ?? 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const latestAppointmentByCustomerId = new Map<
    string,
    { pet_id: string | null; menu: string; start_time: string }
  >()
  recentAppointmentRows.forEach((row) => {
    if (!row.customer_id || row.status === 'キャンセル' || row.status === '無断キャンセル') return
    if (latestAppointmentByCustomerId.has(row.customer_id)) return
    latestAppointmentByCustomerId.set(row.customer_id, {
      pet_id: row.pet_id,
      menu: row.menu,
      start_time: row.start_time,
    })
  })

  const waitlistsByCustomerId = new Map<string, WaitlistRow[]>()
  waitlistRows.forEach((row) => {
    const list = waitlistsByCustomerId.get(row.customer_id) ?? []
    list.push(row)
    waitlistsByCustomerId.set(row.customer_id, list)
  })

  const reoffersByAppointmentId = new Map<
    string,
    Array<{
      id: string
      target_customer_id: string | null
      target_pet_id: string | null
      target_staff_id: string | null
      target_customer_name: string | null
      target_pet_name: string | null
      target_staff_name: string | null
      status: string
      sent_at: string | null
      accepted_at: string | null
      notes: string | null
    }>
  >()
  reofferRows.forEach((row) => {
    const list = reoffersByAppointmentId.get(row.appointment_id) ?? []
    list.push({
      id: row.id,
      target_customer_id: row.target_customer_id,
      target_pet_id: row.target_pet_id,
      target_staff_id: row.target_staff_id,
      target_customer_name: row.target_customer_id
        ? customerById.get(row.target_customer_id)?.full_name ?? null
        : null,
      target_pet_name: row.target_pet_id ? petById.get(row.target_pet_id)?.name ?? null : null,
      target_staff_name: row.target_staff_id ? staffById.get(row.target_staff_id)?.full_name ?? null : null,
      status: row.status,
      sent_at: row.sent_at,
      accepted_at: row.accepted_at,
      notes: row.notes,
    })
    reoffersByAppointmentId.set(row.appointment_id, list)
  })
  const acceptedAppointmentIds = new Set(
    reofferRows.filter((row) => row.status === 'accepted').map((row) => row.appointment_id)
  )

  const notificationLogsByAppointmentId = new Map<
    string,
    Array<{
      id: string
      customer_name: string | null
      channel: string
      status: string
      subject: string | null
      sent_at: string
    }>
  >()
  notificationLogRows.forEach((row) => {
    if (!row.appointment_id) return
    const list = notificationLogsByAppointmentId.get(row.appointment_id) ?? []
    list.push({
      id: row.id,
      customer_name: row.customer_id ? customerById.get(row.customer_id)?.full_name ?? null : null,
      channel: row.channel,
      status: row.status,
      subject: row.subject,
      sent_at: row.sent_at,
    })
    notificationLogsByAppointmentId.set(row.appointment_id, list)
  })

  const reofferLogsByAppointmentId = new Map<
    string,
    Array<{
      id: string
      event_type: string
      created_at: string
      target_customer_name: string | null
    }>
  >()
  reofferLogRows.forEach((row) => {
    const payload = row.payload ?? {}
    const targetCustomerId =
      typeof payload.target_customer_id === 'string' ? payload.target_customer_id : null
    const list = reofferLogsByAppointmentId.get(row.appointment_id) ?? []
    list.push({
      id: row.id,
      event_type: row.event_type,
      created_at: row.created_at,
      target_customer_name: targetCustomerId ? customerById.get(targetCustomerId)?.full_name ?? null : null,
    })
    reofferLogsByAppointmentId.set(row.appointment_id, list)
  })

  const slots = ((canceledAppointments ?? []) as AppointmentRow[])
    .filter((appointment) => !acceptedAppointmentIds.has(appointment.id))
    .map((appointment) => {
    const canceledPet = appointment.pet_id ? petById.get(appointment.pet_id) ?? null : null
    const waitlistCandidates = waitlistRows
      .filter((request) => {
        if (futureBookedCustomerIds.has(request.customer_id)) return false
        if (noShowCounts[request.customer_id] && noShowCounts[request.customer_id] > 0) return false
        if (
          request.desired_from &&
          new Date(request.desired_from).getTime() > new Date(appointment.start_time).getTime()
        ) {
          return false
        }
        if (
          request.desired_to &&
          new Date(request.desired_to).getTime() < new Date(appointment.end_time).getTime()
        ) {
          return false
        }
        if (request.preferred_menu && request.preferred_menu !== appointment.menu) return false
        if (request.preferred_staff_id && request.preferred_staff_id !== appointment.staff_id) return false
        return true
      })
      .map((request) => {
        const customer = customerById.get(request.customer_id)
        const pet = request.pet_id ? petById.get(request.pet_id) ?? null : null
        const sameBreed =
          canceledPet?.breed && pet?.breed ? canceledPet.breed === pet.breed : false
        return {
          source: 'waitlist' as const,
          customer_id: request.customer_id,
          customer_name: customer?.full_name ?? '未登録',
          phone_number: customer?.phone_number ?? null,
          line_id: customer?.line_id ?? null,
          pet_id: request.pet_id,
          pet_name: pet?.name ?? null,
          breed: pet?.breed ?? null,
          score: 3 + (sameBreed ? 1 : 0),
          last_visit_at: null,
          channel: request.channel,
          waitlist_id: request.id,
        }
      })

    const historyCandidates = customerRows
      .filter((customer) => {
        if (futureBookedCustomerIds.has(customer.id)) return false
        if (noShowCounts[customer.id] && noShowCounts[customer.id] > 0) return false
        return Boolean(customer.phone_number || customer.line_id)
      })
      .map((customer) => {
        const latest = latestAppointmentByCustomerId.get(customer.id)
        const pet = latest?.pet_id ? petById.get(latest.pet_id) ?? null : null
        const sameMenu = latest ? latest.menu === appointment.menu : false
        const sameBreed = canceledPet?.breed && pet?.breed ? canceledPet.breed === pet.breed : false
        const score = (sameMenu ? 2 : 0) + (sameBreed ? 1 : 0)
        return {
          source: 'history' as const,
          customer_id: customer.id,
          customer_name: customer.full_name,
          phone_number: customer.phone_number,
          line_id: customer.line_id,
          pet_id: pet?.id ?? null,
          pet_name: pet?.name ?? null,
          breed: pet?.breed ?? null,
          score,
          last_visit_at: latest?.start_time ?? null,
          channel: customer.line_id ? 'line' : customer.phone_number ? 'phone' : 'manual',
          waitlist_id: null,
        }
      })
      .filter((candidate) => candidate.score > 0 || candidate.last_visit_at)

    const candidates = [...waitlistCandidates, ...historyCandidates]
      .filter(
        (candidate, index, array) =>
          array.findIndex((row) => row.customer_id === candidate.customer_id) === index
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aTime = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0
        const bTime = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0
        return aTime - bTime
      })
      .slice(0, 5)

    return {
      appointment_id: appointment.id,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      menu: appointment.menu,
      canceled_pet_name: canceledPet?.name ?? null,
      canceled_pet_breed: canceledPet?.breed ?? null,
      canceled_staff_name: appointment.staff_id ? staffById.get(appointment.staff_id)?.full_name ?? null : null,
      candidates,
      sent_logs: reoffersByAppointmentId.get(appointment.id) ?? [],
      notification_logs: notificationLogsByAppointmentId.get(appointment.id) ?? [],
      timeline: reofferLogsByAppointmentId.get(appointment.id) ?? [],
      actor_user_id: user?.id ?? null,
    }
  })

  const waitlists = waitlistRows.map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    customer_name: customerById.get(row.customer_id)?.full_name ?? '未登録',
    pet_id: row.pet_id,
    pet_name: row.pet_id ? petById.get(row.pet_id)?.name ?? null : null,
    desired_from: row.desired_from,
    desired_to: row.desired_to,
    preferred_menu: row.preferred_menu,
    preferred_staff_id: row.preferred_staff_id,
    preferred_staff_name: row.preferred_staff_id
      ? staffById.get(row.preferred_staff_id)?.full_name ?? null
      : null,
    channel: row.channel,
    notes: row.notes,
    created_at: row.created_at,
  }))

  const customerOptions = customerRows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    phone_number: row.phone_number,
    line_id: row.line_id,
    pets: (petsByCustomerId.get(row.id) ?? []).map((pet) => ({
      id: pet.id,
      name: pet.name,
      breed: pet.breed,
    })),
  }))
  const staffOptions = staffRows.map((row) => ({ id: row.id, full_name: row.full_name }))

  return NextResponse.json({
    slots,
    waitlists,
    customers: customerOptions,
    staffs: staffOptions,
  })
}

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const body = (await request.json().catch(() => null)) as
    | {
        kind?: string
        appointment_id?: string
        target_customer_id?: string
        target_pet_id?: string | null
        target_staff_id?: string | null
        channel?: string
        subject?: string
        notes?: string
        customer_id?: string
        pet_id?: string | null
        desired_from?: string | null
        desired_to?: string | null
        preferred_menu?: string | null
        preferred_staff_id?: string | null
      }
    | null

  const kind = typeof body?.kind === 'string' ? body.kind : 'reoffer'

  if (kind === 'waitlist') {
    const customerId = typeof body?.customer_id === 'string' ? body.customer_id : ''
    const petId = typeof body?.pet_id === 'string' && body.pet_id ? body.pet_id : null
    const preferredMenu =
      typeof body?.preferred_menu === 'string' && body.preferred_menu.trim()
        ? body.preferred_menu.trim()
        : null
    const preferredStaffId =
      typeof body?.preferred_staff_id === 'string' && body.preferred_staff_id ? body.preferred_staff_id : null
    const channel =
      body?.channel === 'line' || body?.channel === 'phone' || body?.channel === 'manual'
        ? body.channel
        : 'manual'
    const desiredFrom =
      typeof body?.desired_from === 'string' && body.desired_from ? body.desired_from : null
    const desiredTo =
      typeof body?.desired_to === 'string' && body.desired_to ? body.desired_to : null
    const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

    if (!customerId) {
      return NextResponse.json({ message: 'customer_id は必須です。' }, { status: 400 })
    }

    const { data: waitlist, error } = await supabase
      .from('slot_waitlist_requests')
      .insert({
        store_id: storeId,
        customer_id: customerId,
        pet_id: petId,
        desired_from: desiredFrom,
        desired_to: desiredTo,
        preferred_menu: preferredMenu,
        preferred_staff_id: preferredStaffId,
        channel,
        notes,
      })
      .select(
        'id, customer_id, pet_id, desired_from, desired_to, preferred_menu, preferred_staff_id, channel, notes, created_at'
      )
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({ waitlist }, { status: 201 })
  }

  const appointmentId = typeof body?.appointment_id === 'string' ? body.appointment_id : ''
  const targetCustomerId =
    typeof body?.target_customer_id === 'string' ? body.target_customer_id : ''
  const targetPetId = typeof body?.target_pet_id === 'string' ? body.target_pet_id : null
  const targetStaffId = typeof body?.target_staff_id === 'string' ? body.target_staff_id : null
  const channel =
    body?.channel === 'line' || body?.channel === 'phone' || body?.channel === 'manual'
      ? body.channel
      : 'manual'
  const subject =
    typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'キャンセル枠のご案内'
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null

  if (!appointmentId || !targetCustomerId) {
    return NextResponse.json({ message: 'appointment_id と target_customer_id は必須です。' }, { status: 400 })
  }

  const sentAt = new Date().toISOString()
  const dedupeKey = dedupeKeyForReoffer({
    appointmentId,
    customerId: targetCustomerId,
    channel,
    dateKey: sentAt.slice(0, 10),
  })

  const [{ data: appointment }, { data: customer }, { data: pet }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, start_time, end_time, menu')
      .eq('id', appointmentId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select('id, full_name, line_id, phone_number')
      .eq('id', targetCustomerId)
      .eq('store_id', storeId)
      .maybeSingle(),
    targetPetId
      ? supabase
          .from('pets')
          .select('id, name')
          .eq('id', targetPetId)
          .eq('store_id', storeId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (!appointment || !customer) {
    return NextResponse.json({ message: '再販対象の予約または顧客が見つかりません。' }, { status: 404 })
  }

  const notificationTarget =
    channel === 'line' ? customer.line_id : channel === 'phone' ? customer.phone_number : null
  const { data: existingNotification } = await supabase
    .from('customer_notification_logs')
    .select('id')
    .eq('store_id', storeId)
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()

  if (existingNotification) {
    await supabase.from('customer_notification_logs').insert({
      store_id: storeId,
      customer_id: targetCustomerId,
      appointment_id: appointmentId,
      actor_user_id: user?.id ?? null,
      channel,
      notification_type: 'slot_reoffer',
      status: 'canceled',
      subject,
      body: notes,
      target: notificationTarget,
      dedupe_key: `${dedupeKey}:skipped`,
      payload: {
        target_customer_id: targetCustomerId,
        target_pet_id: targetPetId,
        target_staff_id: targetStaffId,
        subject,
        notes,
        reason: 'dedupe',
      },
      sent_at: sentAt,
    })
    return NextResponse.json({ message: '同一顧客への再販送信記録は本日分が既にあります。' }, { status: 409 })
  }

  let templateBody: string | null = null
  const { data: templateRow, error: templateError } = await supabase
    .from('notification_templates')
    .select('body')
    .eq('store_id', storeId)
    .eq('template_key', 'slot_reoffer_line')
    .eq('channel', 'line')
    .eq('is_active', true)
    .maybeSingle()
  if (!templateError) {
    templateBody = typeof templateRow?.body === 'string' ? templateRow.body : null
  } else if (!templateError.message.includes('notification_templates')) {
    return NextResponse.json({ message: templateError.message }, { status: 500 })
  }

  let notificationStatus: 'sent' | 'failed' = 'sent'
  let notificationBody = notes
  if (channel === 'line') {
    if (!customer.line_id) {
      return NextResponse.json({ message: 'LINE送信先が未登録です。' }, { status: 400 })
    }

    const lineText = renderSlotReofferLineTemplate({
      customerName: customer.full_name,
      menu: appointment.menu,
      petName: pet?.name ?? null,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      note: notes,
      templateBody: templateBody ?? getDefaultSlotReofferLineTemplate(),
    })
    const messages: Message[] = [{ type: 'text', text: lineText }]
    const sendResult = await sendLineMessage({ to: customer.line_id, messages })
    notificationStatus = sendResult.success ? 'sent' : 'failed'
    notificationBody = lineText
  }

  const { data: reoffer, error: reofferError } = await supabase
    .from('slot_reoffers')
    .insert({
      store_id: storeId,
      appointment_id: appointmentId,
      target_customer_id: targetCustomerId,
      target_pet_id: targetPetId,
      target_staff_id: targetStaffId,
      status: 'sent',
      sent_at: sentAt,
      notes,
    })
    .select('id, appointment_id, target_customer_id, status, sent_at, accepted_at')
    .single()

  if (reofferError) {
    return NextResponse.json({ message: reofferError.message }, { status: 500 })
  }

  const { error: notificationError } = await supabase.from('customer_notification_logs').insert({
    store_id: storeId,
    customer_id: targetCustomerId,
    appointment_id: appointmentId,
    slot_reoffer_id: reoffer.id,
    actor_user_id: user?.id ?? null,
    channel,
    notification_type: 'slot_reoffer',
    status: notificationStatus,
    subject,
    body: notificationBody,
    target: notificationTarget,
    dedupe_key: dedupeKey,
    payload: {
      target_customer_id: targetCustomerId,
      target_pet_id: targetPetId,
      target_staff_id: targetStaffId,
      target: notificationTarget,
      subject,
      notes,
      notification_status: notificationStatus,
    },
    sent_at: sentAt,
  })

  if (notificationError) {
    return NextResponse.json({ message: notificationError.message }, { status: 500 })
  }

  const { error: logError } = await supabase.from('slot_reoffer_logs').insert([
    {
      store_id: storeId,
      slot_reoffer_id: reoffer.id,
      appointment_id: appointmentId,
      actor_user_id: user?.id ?? null,
      event_type: 'candidate_selected',
      payload: {
        target_customer_id: targetCustomerId,
        target_pet_id: targetPetId,
        target_staff_id: targetStaffId,
      },
    },
    {
      store_id: storeId,
      slot_reoffer_id: reoffer.id,
      appointment_id: appointmentId,
      actor_user_id: user?.id ?? null,
      event_type: 'sent',
      payload: {
        target_customer_id: targetCustomerId,
        target_pet_id: targetPetId,
        target_staff_id: targetStaffId,
        channel,
        subject,
        notes,
        notification_status: notificationStatus,
      },
    },
  ])

  if (logError) {
    return NextResponse.json({ message: logError.message }, { status: 500 })
  }

  return NextResponse.json({ reoffer }, { status: 201 })
}
