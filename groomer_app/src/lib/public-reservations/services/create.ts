import { createReservationCancelToken } from '@/lib/reservation-cancel-token'
import { verifySignedPetQrPayload } from '@/lib/qr/pet-profile-signature'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { estimateDurationMinutes } from '@/lib/appointments/duration'
import { ensureAppointmentGroupId } from '@/lib/appointments/groups'
import { validateAppointmentConflict } from '@/lib/appointments/conflict'
import {
  buildSlotCandidates,
  getPublicReserveSlotConfig,
  mergePublicReserveSlotConfig,
} from '@/lib/public-reservations/services/slot-candidates'
import {
  type PublicReservationInput,
  type PublicReservationMenuSnapshot,
  PublicReservationServiceError,
} from '@/lib/public-reservations/services/shared'
import { createPublicReservationCore } from '@/lib/public-reservations/services/create-core'

async function fetchActiveStore(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id, name, is_active')
    .eq('id', storeId)
    .single()

  if (storeError || !store || !store.is_active) {
    throw new PublicReservationServiceError('店舗が見つかりません。', 404)
  }

  return store
}

async function fetchDefaultStaffId(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  storeId: string,
  preferredStaffId?: string
) {
  if (preferredStaffId) {
    const { data: preferredStaff } = await admin
      .from('staffs')
      .select('id')
      .eq('store_id', storeId)
      .eq('id', preferredStaffId)
      .maybeSingle()
    if (preferredStaff?.id) {
      return preferredStaff.id
    }
  }

  const { data: staff } = await admin
    .from('staffs')
    .select('id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!staff?.id) {
    throw new PublicReservationServiceError('店舗側スタッフ未登録のため受付できません。')
  }

  return staff.id
}

async function fetchStorePublicReserveSlotConfig(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  storeId: string
) {
  const baseConfig = getPublicReserveSlotConfig()
  const { data: storeRule } = await admin
    .from('stores')
    .select(
      'public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes'
    )
    .eq('id', storeId)
    .maybeSingle()

  return mergePublicReserveSlotConfig(baseConfig, {
    days: Number(storeRule?.public_reserve_slot_days ?? baseConfig.days),
    intervalMinutes: Number(storeRule?.public_reserve_slot_interval_minutes ?? baseConfig.intervalMinutes),
    bufferMinutes: Number(storeRule?.public_reserve_slot_buffer_minutes ?? baseConfig.bufferMinutes),
    businessStartHour: Number(
      storeRule?.public_reserve_business_start_hour_jst ?? baseConfig.businessStartHour
    ),
    businessEndHour: Number(storeRule?.public_reserve_business_end_hour_jst ?? baseConfig.businessEndHour),
    minLeadMinutes: Number(storeRule?.public_reserve_min_lead_minutes ?? baseConfig.minLeadMinutes),
  })
}

async function fetchSelectedMenus(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  storeId: string,
  menuIds: string[]
) {
  const { data: menuRows, error: menuError } = await admin
    .from('service_menus')
    .select('id, name, price, duration, tax_rate, tax_included, is_instant_bookable')
    .in('id', menuIds)
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (menuError) {
    throw new PublicReservationServiceError(menuError.message, 500)
  }

  const selectedMenus = (menuRows ?? []) as PublicReservationMenuSnapshot[]
  if (selectedMenus.length === 0) {
    throw new PublicReservationServiceError('有効なメニューが見つかりません。')
  }
  return selectedMenus
}

export async function fetchPublicReservationBootstrap(params: { storeId: string }) {
  const admin = createAdminSupabaseClient()
  const store = await fetchActiveStore(admin, params.storeId)

  const { data: menus, error: menuError } = await admin
    .from('service_menus')
    .select('id, name, price, duration, tax_rate, tax_included, is_active, is_instant_bookable')
    .eq('store_id', params.storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (menuError) {
    throw new PublicReservationServiceError(menuError.message, 500)
  }

  const instantMenuIds = (menus ?? [])
    .filter((menu) => Boolean(menu.is_instant_bookable))
    .map((menu) => menu.id)

  return {
    store: { id: store.id, name: store.name },
    menus: menus ?? [],
    instant_menu_ids: instantMenuIds,
  }
}

export async function createPublicReservation(params: {
  storeId: string
  input: PublicReservationInput
  requestOrigin: string
  adminClient?: ReturnType<typeof createAdminSupabaseClient>
  verifyQrPayload?: typeof verifySignedPetQrPayload
}) {
  const { storeId, input, requestOrigin } = params
  const admin = params.adminClient ?? createAdminSupabaseClient()
  const verifyQrPayload = params.verifyQrPayload ?? verifySignedPetQrPayload

  return createPublicReservationCore({
    storeId,
    input,
    requestOrigin,
    deps: {
      async fetchActiveStore(storeId) {
        await fetchActiveStore(admin, storeId)
      },
      async fetchDefaultStaffId(storeId, preferredStaffId) {
        return fetchDefaultStaffId(admin, storeId, preferredStaffId)
      },
      async fetchSelectedMenus(storeId, menuIds) {
        return fetchSelectedMenus(admin, storeId, menuIds)
      },
      async estimateDuration({ storeId, petId, staffId, menus }) {
        return estimateDurationMinutes({
          supabase: admin,
          storeId,
          petId,
          staffId,
          menus,
        })
      },
      async fetchInstantSlotCandidates({ storeId, staffId, serviceDurationMinutes, now }) {
        const config = await fetchStorePublicReserveSlotConfig(admin, storeId)
        const rangeStartIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
        const rangeEndIso = new Date(now.getTime() + config.days * 24 * 60 * 60 * 1000).toISOString()
        const blockedDateRangeStart = now.toISOString().slice(0, 10)
        const blockedDateRangeEnd = rangeEndIso.slice(0, 10)
        const { data: occupiedRows, error } = await admin
          .from('appointments')
          .select('start_time, end_time')
          .eq('store_id', storeId)
          .eq('staff_id', staffId)
          .not('status', 'in', '("キャンセル","無断キャンセル")')
          .lt('start_time', rangeEndIso)
          .gt('end_time', rangeStartIso)

        if (error) {
          throw new PublicReservationServiceError(error.message, 500)
        }
        const { data: blockedDateRows, error: blockedDateError } = await admin
          .from('store_public_reserve_blocked_dates')
          .select('date_key')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .gte('date_key', blockedDateRangeStart)
          .lte('date_key', blockedDateRangeEnd)
        if (blockedDateError) {
          throw new PublicReservationServiceError(blockedDateError.message, 500)
        }
        const blockedDateKeysJst = (blockedDateRows ?? [])
          .map((row) => row.date_key)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)

        return buildSlotCandidates({
          now,
          occupiedAppointments: (occupiedRows ?? []) as Array<{
            start_time: string | null
            end_time: string | null
          }>,
          serviceDurationMinutes,
          config,
          blockedDateKeysJst,
        }).map((slot) => ({
          ...slot,
          staff_id: staffId,
        }))
      },
      verifyQrPayload,
      async fetchPetByQr({ storeId, customerId, petId }) {
        const { data } = await admin
          .from('pets')
          .select('id')
          .eq('id', petId)
          .eq('customer_id', customerId)
          .eq('store_id', storeId)
          .maybeSingle()
        return Boolean(data?.id)
      },
      async fetchCustomerByEmail({ storeId, email }) {
        const { data } = await admin
          .from('customers')
          .select('id, email, phone_number')
          .eq('store_id', storeId)
          .eq('email', email)
          .maybeSingle()
        return data
      },
      async fetchCustomerByPhone({ storeId, phoneNumber }) {
        const { data } = await admin
          .from('customers')
          .select('id, email, phone_number')
          .eq('store_id', storeId)
          .eq('phone_number', phoneNumber)
          .maybeSingle()
        return data
      },
      async fetchCustomerName({ storeId, customerId }) {
        const { data } = await admin
          .from('customers')
          .select('full_name')
          .eq('id', customerId)
          .eq('store_id', storeId)
          .single()
        return data?.full_name ?? null
      },
      async ensureAppointmentGroup({ storeId, customerId, groupId, source }) {
        return ensureAppointmentGroupId({
          supabase: admin,
          storeId,
          customerId,
          existingGroupId: groupId,
          source,
        })
      },
      async createCustomer({ storeId, input }) {
        const { data, error } = await admin
          .from('customers')
          .insert({
            store_id: storeId,
            full_name: input.customerName,
            phone_number: input.phoneNumber || null,
            email: input.email || null,
          })
          .select('id')
          .single()
        if (error || !data?.id) {
          throw new PublicReservationServiceError(error?.message ?? '顧客登録に失敗しました。', 500)
        }
        return data.id
      },
      async updateCustomerContacts({ storeId, customerId, email, phoneNumber }) {
        await admin
          .from('customers')
          .update({
            email,
            phone_number: phoneNumber,
          })
          .eq('id', customerId)
          .eq('store_id', storeId)
      },
      async fetchExistingPet({ storeId, customerId, petName }) {
        const { data } = await admin
          .from('pets')
          .select('id')
          .eq('store_id', storeId)
          .eq('customer_id', customerId)
          .eq('name', petName)
          .maybeSingle()
        return data?.id ?? null
      },
      async createPet({ storeId, customerId, input }) {
        const { data, error } = await admin
          .from('pets')
          .insert({
            store_id: storeId,
            customer_id: customerId,
            name: input.petName,
            breed: input.petBreed || null,
            gender: input.petGender || null,
          })
          .select('id')
          .single()
        if (error || !data?.id) {
          throw new PublicReservationServiceError(error?.message ?? 'ペット登録に失敗しました。', 500)
        }
        return data.id
      },
      async createAppointment({
        storeId,
        groupId,
        customerId,
        petId,
        staffId,
        startTimeIso,
        endTimeIso,
        menuSummaryNames,
        duration,
        status,
        notes,
      }) {
        const { data, error } = await admin
          .from('appointments')
          .insert({
            store_id: storeId,
            group_id: groupId,
            customer_id: customerId,
            pet_id: petId,
            staff_id: staffId,
            start_time: startTimeIso,
            end_time: endTimeIso,
            menu: menuSummaryNames,
            duration,
            status,
            notes,
          })
          .select('id')
          .single()
        if (error || !data?.id) {
          throw new PublicReservationServiceError(error?.message ?? '予約作成に失敗しました。', 500)
        }
        return data.id
      },
      async validateAppointmentConflict({ storeId, staffId, startTimeIso, endTimeIso }) {
        return validateAppointmentConflict({
          supabase: admin,
          storeId,
          staffId,
          startTimeIso,
          endTimeIso,
        })
      },
      async insertAppointmentMenus({ storeId, appointmentId, menus }) {
        const payload = menus.map((menu) => ({
          store_id: storeId,
          appointment_id: appointmentId,
          menu_id: menu.id,
          menu_name: menu.name,
          price: menu.price,
          duration: menu.duration,
          tax_rate: menu.tax_rate ?? 0.1,
          tax_included: menu.tax_included ?? true,
        }))
        const { error } = await admin.from('appointment_menus').insert(payload)
        if (error) {
          throw new PublicReservationServiceError(error.message, 500)
        }
      },
      createCancelToken({ appointmentId, storeId }) {
        return createReservationCancelToken({ appointmentId, storeId })
      },
      createGroupCancelToken({ appointmentId, storeId, groupId }) {
        return createReservationCancelToken({ appointmentId, storeId, groupId })
      },
    },
  })
}
