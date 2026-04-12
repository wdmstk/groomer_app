import {
  addMinutes,
  calculateMenuSummary,
  type PublicReservationPaymentMethod,
  normalizeName,
  type PublicReservationInput,
  type PublicReservationMenuSnapshot,
  PublicReservationServiceError,
  toUtcIsoFromJstInput,
  validatePublicReservationInput,
} from './shared.ts'

type CustomerRecord = {
  id: string
  email: string | null
  phone_number: string | null
}

type VerifiedQrPayload =
  | {
      ok: true
      payload: {
        customer_id: string
        pet_id: string
      }
    }
  | { ok: false }
  | null

export type CreatePublicReservationDeps = {
  fetchActiveStore(storeId: string): Promise<void>
  fetchDefaultStaffId(storeId: string, preferredStaffId?: string): Promise<string>
  fetchSelectedMenus(storeId: string, menuIds: string[]): Promise<PublicReservationMenuSnapshot[]>
  fetchReservationPaymentSettings(storeId: string): Promise<{
    prepayment_enabled: boolean
    card_hold_enabled: boolean
  }>
  estimateDuration(params: {
    storeId: string
    petId: string
    staffId: string
    menus: Array<{ id: string; duration: number }>
  }): Promise<number>
  fetchInstantSlotCandidates(params: {
    storeId: string
    staffId: string
    serviceDurationMinutes: number
    now: Date
  }): Promise<Array<{ start_time: string; end_time: string; staff_id?: string | null }>>
  verifyQrPayload(qrPayloadText: string): VerifiedQrPayload
  fetchPetByQr(params: { storeId: string; customerId: string; petId: string }): Promise<boolean>
  fetchCustomerByEmail(params: { storeId: string; email: string }): Promise<CustomerRecord | null>
  fetchCustomerByPhone(params: { storeId: string; phoneNumber: string }): Promise<CustomerRecord | null>
  fetchCustomerName(params: { storeId: string; customerId: string }): Promise<string | null>
  ensureAppointmentGroup(params: {
    storeId: string
    customerId: string
    groupId?: string | null
    source: 'public' | 'member_portal'
  }): Promise<string>
  createCustomer(params: { storeId: string; input: PublicReservationInput }): Promise<string>
  updateCustomerContacts(params: {
    storeId: string
    customerId: string
    email: string | null
    phoneNumber: string | null
  }): Promise<void>
  fetchExistingPet(params: { storeId: string; customerId: string; petName: string }): Promise<string | null>
  createPet(params: { storeId: string; customerId: string; input: PublicReservationInput }): Promise<string>
  createAppointment(params: {
    storeId: string
    groupId: string
    customerId: string
    petId: string
    staffId: string
    startTimeIso: string
    endTimeIso: string
    menuSummaryNames: string
    duration: number
    status: '予約申請' | '予約済'
    reservationPaymentMethod: PublicReservationPaymentMethod
    notes: string
  }): Promise<string>
  validateAppointmentConflict(params: {
    storeId: string
    staffId: string
    startTimeIso: string
    endTimeIso: string
  }): Promise<{ ok: true } | { ok: false; message: string }>
  insertAppointmentMenus(params: {
    storeId: string
    appointmentId: string
    menus: PublicReservationMenuSnapshot[]
  }): Promise<void>
  createCancelToken(params: { appointmentId: string; storeId: string }): string
  createGroupCancelToken(params: { appointmentId: string; storeId: string; groupId: string }): string
}

async function resolveCustomerAndPetCore(params: {
  deps: CreatePublicReservationDeps
  storeId: string
  input: PublicReservationInput
}) {
  const { deps, storeId, input } = params
  const verifiedQr = input.qrPayloadText ? deps.verifyQrPayload(input.qrPayloadText) : null
  if (input.qrPayloadText && (!verifiedQr || !verifiedQr.ok)) {
    throw new PublicReservationServiceError('QR署名が不正です。再読取してください。')
  }

  let customerId: string | null = null
  let petIdFromQr: string | null = null
  if (verifiedQr?.ok) {
    const qr = verifiedQr.payload
    const qrPetExists = await deps.fetchPetByQr({
      storeId,
      customerId: qr.customer_id,
      petId: qr.pet_id,
    })

    if (!qrPetExists) {
      throw new PublicReservationServiceError('QRの顧客・ペットが店舗データと一致しません。')
    }

    customerId = qr.customer_id
    petIdFromQr = qr.pet_id
  }

  let customerFromEmail: CustomerRecord | null = null
  let customerFromPhone: CustomerRecord | null = null

  if (!customerId && input.email) {
    customerFromEmail = await deps.fetchCustomerByEmail({ storeId, email: input.email })
  }

  if (!customerId && !customerFromEmail && input.phoneNumber) {
    customerFromPhone = await deps.fetchCustomerByPhone({
      storeId,
      phoneNumber: input.phoneNumber,
    })
  }

  customerId = customerId ?? customerFromEmail?.id ?? customerFromPhone?.id ?? null

  if (!customerFromEmail && customerFromPhone && customerId) {
    const existingName = (await deps.fetchCustomerName({ storeId, customerId })) ?? ''
    if (normalizeName(existingName) !== normalizeName(input.customerName)) {
      customerId = null
    }
  }

  if (!customerId) {
    customerId = await deps.createCustomer({ storeId, input })
  } else {
    const baseCustomer = customerFromEmail ?? customerFromPhone
    if (baseCustomer) {
      const nextEmail = baseCustomer.email ?? (input.email || null)
      const nextPhoneNumber = baseCustomer.phone_number ?? (input.phoneNumber || null)
      const shouldUpdate =
        nextEmail !== baseCustomer.email || nextPhoneNumber !== baseCustomer.phone_number

      if (shouldUpdate) {
        await deps.updateCustomerContacts({
          storeId,
          customerId,
          email: nextEmail,
          phoneNumber: nextPhoneNumber,
        })
      }
    }
  }

  let petId = petIdFromQr
  if (!petId) {
    petId = await deps.fetchExistingPet({
      storeId,
      customerId,
      petName: input.petName,
    })
  }

  if (!petId) {
    petId = await deps.createPet({ storeId, customerId, input })
  }

  return { customerId, petId }
}

export async function createPublicReservationCore(params: {
  storeId: string
  input: PublicReservationInput
  requestOrigin: string
  deps: CreatePublicReservationDeps
}) {
  const { storeId, input, requestOrigin, deps } = params
  validatePublicReservationInput(input)

  await deps.fetchActiveStore(storeId)
  const staffId = await deps.fetchDefaultStaffId(storeId, input.preferredStaffId)
  const selectedMenus = await deps.fetchSelectedMenus(storeId, input.menuIds)
  const { customerId, petId } = await resolveCustomerAndPetCore({
    deps,
    storeId,
    input,
  })

  const startTimeIso = toUtcIsoFromJstInput(input.preferredStart)
  if (!startTimeIso) {
    throw new PublicReservationServiceError('希望日時の形式が不正です。')
  }

  const summary = calculateMenuSummary(selectedMenus)
  const estimatedDuration = await deps.estimateDuration({
    storeId,
    petId,
    staffId,
    menus: selectedMenus.map((menu) => ({ id: menu.id, duration: menu.duration })),
  })
  const endTimeIso = addMinutes(startTimeIso, estimatedDuration)
  const isInstantReservation = selectedMenus.every((menu) => Boolean(menu.is_instant_bookable))
  const appointmentStatus: '予約申請' | '予約済' = isInstantReservation ? '予約済' : '予約申請'
  const reservationPaymentSettings = await deps.fetchReservationPaymentSettings(storeId)
  const reservationPaymentMethod: PublicReservationPaymentMethod = isInstantReservation
    ? 'prepayment'
    : 'card_hold'
  if (isInstantReservation && !reservationPaymentSettings.prepayment_enabled) {
    throw new PublicReservationServiceError('店舗の事前決済設定（即時確定）が未設定です。', 400)
  }
  if (!isInstantReservation && !reservationPaymentSettings.card_hold_enabled) {
    throw new PublicReservationServiceError('店舗の事前決済設定（承認後決済）が未設定です。', 400)
  }
  if (isInstantReservation) {
    const slotCandidates = await deps.fetchInstantSlotCandidates({
      storeId,
      staffId,
      serviceDurationMinutes: estimatedDuration,
      now: new Date(),
    })
    const hasMatchingSlot = slotCandidates.some(
      (slot) =>
        slot.start_time === startTimeIso &&
        (!slot.staff_id || slot.staff_id === staffId)
    )
    if (!hasMatchingSlot) {
      throw new PublicReservationServiceError(
        '選択された時間は公開枠ルール外か、すでに利用できません。別の候補枠を選択してください。',
        409
      )
    }

    const conflictCheck = await deps.validateAppointmentConflict({
      storeId,
      staffId,
      startTimeIso,
      endTimeIso,
    })
    if (!conflictCheck.ok) {
      throw new PublicReservationServiceError(
        conflictCheck.message || '直前に枠が埋まりました。別の時間帯を選択してください。',
        409
      )
    }
  }
  const requestNotePrefix = input.memberPortalToken ? '会員証経由Web申請' : '顧客Web申請'
  const mergedNotes = input.notes ? `${requestNotePrefix}: ${input.notes}` : requestNotePrefix
  const groupId = await deps.ensureAppointmentGroup({
    storeId,
    customerId,
    groupId: input.groupId ?? null,
    source: input.memberPortalToken ? 'member_portal' : 'public',
  })

  const appointmentId = await deps.createAppointment({
    storeId,
    groupId,
    customerId,
    petId,
    staffId,
    startTimeIso,
    endTimeIso,
    menuSummaryNames: summary.names,
    duration: estimatedDuration,
    status: appointmentStatus,
    reservationPaymentMethod,
    notes: mergedNotes,
  })

  await deps.insertAppointmentMenus({
    storeId,
    appointmentId,
    menus: selectedMenus,
  })

  const cancelToken = deps.createCancelToken({
    appointmentId,
    storeId,
  })
  const groupCancelToken = deps.createGroupCancelToken({
    appointmentId,
    storeId,
    groupId,
  })

  return {
    message: isInstantReservation
      ? '予約を確定しました。ご来店をお待ちしています。'
      : '予約申請を受け付けました。店舗確認後に確定となります。',
    appointmentId,
    groupId,
    customerId,
    petId,
    status: appointmentStatus,
    reservationPaymentMethod,
    assignedStaffId: staffId,
    cancelUrl: `${requestOrigin}/reserve/cancel?token=${encodeURIComponent(groupCancelToken || cancelToken)}`,
  }
}
