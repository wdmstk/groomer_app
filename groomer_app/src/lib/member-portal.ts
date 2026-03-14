import crypto from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

export const MEMBER_PORTAL_LINK_DAYS = 90
const REVISIT_RECOMMEND_DAYS = 45

export class MemberPortalServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'MemberPortalServiceError'
    this.status = status
  }
}

type MemberPortalLinkRow = {
  id: string
  store_id: string
  customer_id: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
}

type MemberPortalAccessContext = {
  ipHash?: string | null
  uaHash?: string | null
}

async function insertMemberPortalAuditLogBestEffort(params: {
  storeId: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  payload?: Json
}) {
  try {
    const adminSupabase = createAdminSupabaseClient()
    await adminSupabase.from('audit_logs').insert({
      store_id: params.storeId,
      actor_user_id: null,
      entity_type: 'member_portal_link',
      entity_id: params.entityId,
      action: params.action,
      before: (params.before ?? null) as Json,
      after: (params.after ?? null) as Json,
      payload: params.payload ?? {},
    })
  } catch (error) {
    console.error('Failed to insert member portal audit log:', error)
  }
}

type AppointmentRelationRow = {
  id: string
  start_time: string
  status: string | null
  menu: string | null
  pets: { name: string | null } | Array<{ name: string | null }> | null
  staffs: { full_name: string | null } | Array<{ full_name: string | null }> | null
}

type VisitRelationRow = {
  id: string
  visit_date: string
  menu: string | null
  total_amount: number | null
  staffs: { full_name: string | null } | Array<{ full_name: string | null }> | null
}

type CustomerRow = {
  id: string
  full_name: string
}

type StoreRow = {
  id: string
  name: string
}

type PetRow = {
  id: string
  name: string
  breed: string | null
  customer_id: string
}

function pickFirstRelationValue<
  T extends Record<string, string | null>,
  K extends keyof T,
>(value: T | T[] | null | undefined, key: K) {
  if (Array.isArray(value)) {
    return value[0]?.[key] ?? null
  }
  return value?.[key] ?? null
}

export function generateMemberPortalToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function hashMemberPortalToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function isValidMemberPortalTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]{20,128}$/.test(token)
}

export function getMemberPortalExpiresAt(days = MEMBER_PORTAL_LINK_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function getMemberPortalPayload(
  token: string,
  options: {
    touchLastUsedAt?: boolean
    accessContext?: MemberPortalAccessContext
  } = {}
) {
  if (!token) {
    throw new MemberPortalServiceError('会員証URLが不正です。', 400)
  }
  if (!isValidMemberPortalTokenFormat(token)) {
    throw new MemberPortalServiceError('会員証URLが不正です。', 400)
  }

  const adminSupabase = createAdminSupabaseClient()
  const tokenHash = hashMemberPortalToken(token)

  const { data: link, error: linkError } = await adminSupabase
    .from('member_portal_links')
    .select('id, store_id, customer_id, expires_at, revoked_at, last_used_at')
    .eq('token_hash', tokenHash)
    .eq('purpose', 'member_portal')
    .maybeSingle()

  if (linkError) {
    throw new MemberPortalServiceError(linkError.message, 500)
  }

  if (!link) {
    throw new MemberPortalServiceError('会員証URLが見つかりません。', 404)
  }

  const portalLink = link as MemberPortalLinkRow

  const accessPayload = {
    ip_hash: options.accessContext?.ipHash ?? null,
    ua_hash: options.accessContext?.uaHash ?? null,
    token_id: portalLink.id,
    customer_id: portalLink.customer_id,
  }

  if (portalLink.revoked_at) {
    await insertMemberPortalAuditLogBestEffort({
      storeId: portalLink.store_id,
      entityId: portalLink.id,
      action: 'access_revoked',
      payload: {
        ...accessPayload,
        result: 'revoked',
        expires_at: portalLink.expires_at,
      },
    })
    throw new MemberPortalServiceError('この会員証URLは無効化されています。', 410)
  }

  const nowIso = new Date().toISOString()
  if (portalLink.expires_at <= nowIso) {
    await insertMemberPortalAuditLogBestEffort({
      storeId: portalLink.store_id,
      entityId: portalLink.id,
      action: 'access_expired',
      payload: {
        ...accessPayload,
        result: 'expired',
        expires_at: portalLink.expires_at,
      },
    })
    throw new MemberPortalServiceError('この会員証URLは有効期限切れです。', 410)
  }

  if (options.touchLastUsedAt ?? true) {
    const touchAt = new Date().toISOString()
    await adminSupabase
      .from('member_portal_links')
      .update({
        last_used_at: touchAt,
        updated_at: touchAt,
      })
      .eq('id', portalLink.id)

    await insertMemberPortalAuditLogBestEffort({
      storeId: portalLink.store_id,
      entityId: portalLink.id,
      action: 'accessed',
      before: {
        last_used_at: portalLink.last_used_at,
      },
      after: {
        last_used_at: touchAt,
      },
      payload: {
        ...accessPayload,
        result: 'success',
        expires_at: portalLink.expires_at,
      },
    })

    portalLink.last_used_at = touchAt
  }

  const [customerResult, storeResult, appointmentResult, visitResult] = await Promise.all([
    adminSupabase
      .from('customers')
      .select('id, full_name')
      .eq('id', portalLink.customer_id)
      .eq('store_id', portalLink.store_id)
      .maybeSingle(),
    adminSupabase
      .from('stores')
      .select('id, name')
      .eq('id', portalLink.store_id)
      .maybeSingle(),
    adminSupabase
      .from('appointments')
      .select('id, start_time, status, menu, pets(name), staffs(full_name)')
      .eq('store_id', portalLink.store_id)
      .eq('customer_id', portalLink.customer_id)
      .neq('status', 'キャンセル')
      .neq('status', '無断キャンセル')
      .gte('start_time', nowIso)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    adminSupabase
      .from('visits')
      .select('id, visit_date, menu, total_amount, staffs(full_name)')
      .eq('store_id', portalLink.store_id)
      .eq('customer_id', portalLink.customer_id)
      .order('visit_date', { ascending: false })
      .limit(5),
  ])

  if (customerResult.error) {
    throw new MemberPortalServiceError(customerResult.error.message, 500)
  }

  if (storeResult.error) {
    throw new MemberPortalServiceError(storeResult.error.message, 500)
  }

  if (appointmentResult.error) {
    throw new MemberPortalServiceError(appointmentResult.error.message, 500)
  }
  if (visitResult.error) {
    throw new MemberPortalServiceError(visitResult.error.message, 500)
  }

  if (!customerResult.data || !storeResult.data) {
    throw new MemberPortalServiceError('会員証データが見つかりません。', 404)
  }

  const customer = customerResult.data as CustomerRow
  const store = storeResult.data as StoreRow
  const appointment = appointmentResult.data as AppointmentRelationRow | null
  const visits = (visitResult.data ?? []) as VisitRelationRow[]
  const latestVisit = visits[0] ?? null
  const nextVisitSuggestion =
    !appointment && latestVisit
      ? {
          recommended_date: new Date(
            new Date(latestVisit.visit_date).getTime() + REVISIT_RECOMMEND_DAYS * 24 * 60 * 60 * 1000
          ).toISOString(),
          reason: `前回ご来店から ${REVISIT_RECOMMEND_DAYS} 日を目安にご案内しています。`,
        }
      : null
  const announcements: Array<{
    id: string
    title: string
    body: string
    published_at: string
  }> = []
  if (appointment) {
    announcements.push({
      id: 'next-appointment-reminder',
      title: '次回予約のご案内',
      body: '前日までに体調やご要望の変更があれば、店舗へご連絡ください。',
      published_at: nowIso,
    })
  } else {
    announcements.push({
      id: 'no-next-appointment',
      title: '次回予約のご案内',
      body: '次回予約が未登録です。ご希望日時が決まり次第、予約フォームから申請できます。',
      published_at: nowIso,
    })
  }
  if (nextVisitSuggestion) {
    announcements.push({
      id: 'revisit-suggestion',
      title: '次回来店目安',
      body: `${new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(nextVisitSuggestion.recommended_date))} 頃のご来店をご検討ください。`,
      published_at: nowIso,
    })
  }
  const optimizedAnnouncements = announcements.slice(0, 2)

  return {
    customer: {
      id: customer.id,
      full_name: customer.full_name,
    },
    store: {
      id: store.id,
      name: store.name,
    },
    memberCard: {
      label: 'LINE会員証',
      expiresAt: portalLink.expires_at,
    },
    nextAppointment: appointment
      ? {
          id: appointment.id,
          start_time: appointment.start_time,
          status: appointment.status,
          menu: appointment.menu,
          staff_name: pickFirstRelationValue(appointment.staffs, 'full_name'),
          pet_name: pickFirstRelationValue(appointment.pets, 'name'),
        }
      : null,
    nextVisitSuggestion,
    visitHistory: visits.map((visit) => ({
      id: visit.id,
      visit_date: visit.visit_date,
      menu: visit.menu,
      total_amount: visit.total_amount,
      staff_name: pickFirstRelationValue(visit.staffs, 'full_name'),
    })),
    announcements: optimizedAnnouncements,
  }
}

export async function getMemberPortalReservationPrefill(
  token: string,
  options: {
    touchLastUsedAt?: boolean
    accessContext?: MemberPortalAccessContext
  } = {}
) {
  const payload = await getMemberPortalPayload(token, options)
  const adminSupabase = createAdminSupabaseClient()

  const { data: customerRow, error: customerError } = await adminSupabase
    .from('customers')
    .select('id, full_name, phone_number, email')
    .eq('id', payload.customer.id)
    .eq('store_id', payload.store.id)
    .maybeSingle()

  if (customerError) {
    throw new MemberPortalServiceError(customerError.message, 500)
  }

  if (!customerRow) {
    throw new MemberPortalServiceError('顧客情報を解決できません。', 404)
  }

  const { data: pets, error: petError } = await adminSupabase
    .from('pets')
    .select('id, name, breed, customer_id')
    .eq('store_id', payload.store.id)
    .eq('customer_id', payload.customer.id)
    .order('created_at', { ascending: true })

  if (petError) {
    throw new MemberPortalServiceError(petError.message, 500)
  }

  const petList = ((pets ?? []) as PetRow[]) ?? []
  const preferredPet =
    petList.find((pet) => pet.name === payload.nextAppointment?.pet_name) ??
    petList[0] ??
    null

  return {
    store: payload.store,
    customer: {
      id: customerRow.id as string,
      full_name: customerRow.full_name as string,
      phone_number: (customerRow.phone_number as string | null) ?? '',
      email: (customerRow.email as string | null) ?? '',
    },
    pet: preferredPet
      ? {
          id: preferredPet.id,
          name: preferredPet.name,
          breed: preferredPet.breed ?? '',
        }
      : null,
    pets: petList.map((pet) => ({
      id: pet.id,
      name: pet.name,
      breed: pet.breed ?? '',
    })),
  }
}
