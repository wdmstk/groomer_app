import { createReservationCancelToken } from '@/lib/reservation-cancel-token'
import { verifySignedPetQrPayload } from '@/lib/qr/pet-profile-signature'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
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

async function fetchDefaultStaffId(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
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

async function fetchSelectedMenus(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  storeId: string,
  menuIds: string[]
) {
  const { data: menuRows, error: menuError } = await admin
    .from('service_menus')
    .select('id, name, price, duration, tax_rate, tax_included')
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
    .select('id, name, price, duration, tax_rate, tax_included, is_active')
    .eq('store_id', params.storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (menuError) {
    throw new PublicReservationServiceError(menuError.message, 500)
  }

  return {
    store: { id: store.id, name: store.name },
    menus: menus ?? [],
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
      async fetchDefaultStaffId(storeId) {
        return fetchDefaultStaffId(admin, storeId)
      },
      async fetchSelectedMenus(storeId, menuIds) {
        return fetchSelectedMenus(admin, storeId, menuIds)
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
        customerId,
        petId,
        staffId,
        startTimeIso,
        endTimeIso,
        menuSummaryNames,
        duration,
        notes,
      }) {
        const { data, error } = await admin
          .from('appointments')
          .insert({
            store_id: storeId,
            customer_id: customerId,
            pet_id: petId,
            staff_id: staffId,
            start_time: startTimeIso,
            end_time: endTimeIso,
            menu: menuSummaryNames,
            duration,
            status: '予約申請',
            notes,
          })
          .select('id')
          .single()
        if (error || !data?.id) {
          throw new PublicReservationServiceError(error?.message ?? '予約作成に失敗しました。', 500)
        }
        return data.id
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
    },
  })
}
