import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPublicReservationCore,
  type CreatePublicReservationDeps,
} from '../src/lib/public-reservations/services/create-core.ts'
import type { PublicReservationInput } from '../src/lib/public-reservations/services/shared.ts'

test('createPublicReservationCore creates customer, pet, appointment, and cancel URL', async () => {
  const calls: string[] = []
  const appointmentMenus: Array<{ storeId: string; appointmentId: string; menuCount: number }> = []

  const deps: CreatePublicReservationDeps = {
    async fetchActiveStore() {
      calls.push('fetchActiveStore')
    },
    async fetchDefaultStaffId() {
      calls.push('fetchDefaultStaffId')
      return 'staff-1'
    },
    async fetchSelectedMenus() {
      calls.push('fetchSelectedMenus')
      return [
        {
          id: 'menu-1',
          name: 'シャンプー',
          price: 5000,
          duration: 60,
          tax_rate: 0.1,
          tax_included: true,
          is_instant_bookable: false,
        },
      ]
    },
    async estimateDuration() {
      calls.push('estimateDuration')
      return 75
    },
    async fetchInstantSlotCandidates() {
      calls.push('fetchInstantSlotCandidates')
      return []
    },
    verifyQrPayload() {
      return null
    },
    async fetchPetByQr() {
      return false
    },
    async fetchCustomerByEmail() {
      return null
    },
    async fetchCustomerByPhone() {
      return null
    },
    async fetchCustomerName() {
      return null
    },
    async ensureAppointmentGroup() {
      calls.push('ensureAppointmentGroup')
      return 'group-1'
    },
    async createCustomer() {
      calls.push('createCustomer')
      return 'customer-1'
    },
    async updateCustomerContacts() {
      calls.push('updateCustomerContacts')
    },
    async fetchExistingPet() {
      calls.push('fetchExistingPet')
      return null
    },
    async createPet() {
      calls.push('createPet')
      return 'pet-1'
    },
    async createAppointment(params) {
      calls.push('createAppointment')
      assert.equal(params.groupId, 'group-1')
      assert.equal(params.menuSummaryNames, 'シャンプー')
      assert.equal(params.duration, 75)
      assert.equal(params.status, '予約申請')
      assert.equal(params.notes, '顧客Web申請: 初回です')
      assert.equal(params.startTimeIso, '2026-03-01T01:00:00.000Z')
      assert.equal(params.endTimeIso, '2026-03-01T02:15:00.000Z')
      return 'appointment-1'
    },
    async validateAppointmentConflict() {
      calls.push('validateAppointmentConflict')
      return { ok: true }
    },
    async insertAppointmentMenus({ storeId, appointmentId, menus }) {
      calls.push('insertAppointmentMenus')
      appointmentMenus.push({ storeId, appointmentId, menuCount: menus.length })
    },
    createCancelToken({ appointmentId, storeId }) {
      return `${storeId}:${appointmentId}`
    },
    createGroupCancelToken({ groupId, storeId }) {
      return `${storeId}:${groupId}`
    },
  }

  const input: PublicReservationInput = {
    customerName: '山田 太郎',
    phoneNumber: '09000000000',
    email: 'user@example.com',
    petName: 'ポチ',
    petBreed: '柴犬',
    petGender: 'male',
    preferredStart: '2026-03-01T10:00',
    notes: '初回です',
    qrPayloadText: '',
    menuIds: ['menu-1'],
  }

  const result = await createPublicReservationCore({
    storeId: 'store-1',
    input,
    requestOrigin: 'https://example.com',
    deps,
  })

  assert.equal(result.appointmentId, 'appointment-1')
  assert.equal(result.groupId, 'group-1')
  assert.equal(result.status, '予約申請')
  assert.equal(
    result.cancelUrl,
    'https://example.com/reserve/cancel?token=store-1%3Agroup-1'
  )
  assert.deepEqual(appointmentMenus, [
    { storeId: 'store-1', appointmentId: 'appointment-1', menuCount: 1 },
  ])
  assert.deepEqual(calls, [
    'fetchActiveStore',
    'fetchDefaultStaffId',
    'fetchSelectedMenus',
    'createCustomer',
    'fetchExistingPet',
    'createPet',
    'estimateDuration',
    'ensureAppointmentGroup',
    'createAppointment',
    'insertAppointmentMenus',
  ])
})

test('createPublicReservationCore confirms instantly for instant-bookable menus', async () => {
  const deps: CreatePublicReservationDeps = {
    async fetchActiveStore() {},
    async fetchDefaultStaffId() {
      return 'staff-1'
    },
    async fetchSelectedMenus() {
      return [
        {
          id: 'menu-1',
          name: 'シャンプー',
          price: 5000,
          duration: 60,
          tax_rate: 0.1,
          tax_included: true,
          is_instant_bookable: true,
        },
      ]
    },
    async estimateDuration() {
      return 60
    },
    async fetchInstantSlotCandidates() {
      return [
        {
          start_time: '2026-03-01T01:00:00.000Z',
          end_time: '2026-03-01T02:00:00.000Z',
        },
      ]
    },
    verifyQrPayload() {
      return null
    },
    async fetchPetByQr() {
      return false
    },
    async fetchCustomerByEmail() {
      return null
    },
    async fetchCustomerByPhone() {
      return null
    },
    async fetchCustomerName() {
      return null
    },
    async ensureAppointmentGroup() {
      return 'group-2'
    },
    async createCustomer() {
      return 'customer-1'
    },
    async updateCustomerContacts() {},
    async fetchExistingPet() {
      return null
    },
    async createPet() {
      return 'pet-1'
    },
    async createAppointment(params) {
      assert.equal(params.groupId, 'group-2')
      assert.equal(params.status, '予約済')
      return 'appointment-2'
    },
    async validateAppointmentConflict() {
      return { ok: true }
    },
    async insertAppointmentMenus() {},
    createCancelToken() {
      return 'token'
    },
    createGroupCancelToken() {
      return 'group-token'
    },
  }

  const result = await createPublicReservationCore({
    storeId: 'store-1',
    input: {
      customerName: '山田 太郎',
      phoneNumber: '09000000000',
      email: 'user@example.com',
      petName: 'ポチ',
      petBreed: '柴犬',
      petGender: 'male',
      preferredStart: '2026-03-01T10:00',
      notes: '',
      qrPayloadText: '',
      menuIds: ['menu-1'],
    },
    requestOrigin: 'https://example.com',
    deps,
  })

  assert.equal(result.status, '予約済')
})

test('createPublicReservationCore rejects instant confirmation when slot conflicts', async () => {
  const deps: CreatePublicReservationDeps = {
    async fetchActiveStore() {},
    async fetchDefaultStaffId() {
      return 'staff-1'
    },
    async fetchSelectedMenus() {
      return [
        {
          id: 'menu-1',
          name: 'シャンプー',
          price: 5000,
          duration: 60,
          tax_rate: 0.1,
          tax_included: true,
          is_instant_bookable: true,
        },
      ]
    },
    async estimateDuration() {
      return 60
    },
    async fetchInstantSlotCandidates() {
      return [
        {
          start_time: '2026-03-01T01:00:00.000Z',
          end_time: '2026-03-01T02:00:00.000Z',
        },
      ]
    },
    verifyQrPayload() {
      return null
    },
    async fetchPetByQr() {
      return false
    },
    async fetchCustomerByEmail() {
      return null
    },
    async fetchCustomerByPhone() {
      return null
    },
    async fetchCustomerName() {
      return null
    },
    async ensureAppointmentGroup() {
      return 'group-3'
    },
    async createCustomer() {
      return 'customer-1'
    },
    async updateCustomerContacts() {},
    async fetchExistingPet() {
      return null
    },
    async createPet() {
      return 'pet-1'
    },
    async createAppointment() {
      throw new Error('should not create appointment')
    },
    async validateAppointmentConflict() {
      return { ok: false, message: '同じスタッフに時間が重複する予約があります。' }
    },
    async insertAppointmentMenus() {},
    createCancelToken() {
      return 'token'
    },
    createGroupCancelToken() {
      return 'group-token'
    },
  }

  await assert.rejects(
    () =>
      createPublicReservationCore({
        storeId: 'store-1',
        input: {
          customerName: '山田 太郎',
          phoneNumber: '09000000000',
          email: 'user@example.com',
          petName: 'ポチ',
          petBreed: '柴犬',
          petGender: 'male',
          preferredStart: '2026-03-01T10:00',
          notes: '',
          qrPayloadText: '',
          menuIds: ['menu-1'],
        },
        requestOrigin: 'https://example.com',
        deps,
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('同じスタッフに時間が重複する予約があります。')
  )
})

test('createPublicReservationCore rejects instant confirmation when start is outside published slots', async () => {
  const deps: CreatePublicReservationDeps = {
    async fetchActiveStore() {},
    async fetchDefaultStaffId() {
      return 'staff-1'
    },
    async fetchSelectedMenus() {
      return [
        {
          id: 'menu-1',
          name: 'シャンプー',
          price: 5000,
          duration: 60,
          tax_rate: 0.1,
          tax_included: true,
          is_instant_bookable: true,
        },
      ]
    },
    async estimateDuration() {
      return 60
    },
    async fetchInstantSlotCandidates() {
      return [
        {
          start_time: '2026-03-01T02:00:00.000Z',
          end_time: '2026-03-01T03:00:00.000Z',
        },
      ]
    },
    verifyQrPayload() {
      return null
    },
    async fetchPetByQr() {
      return false
    },
    async fetchCustomerByEmail() {
      return null
    },
    async fetchCustomerByPhone() {
      return null
    },
    async fetchCustomerName() {
      return null
    },
    async ensureAppointmentGroup() {
      return 'group-4'
    },
    async createCustomer() {
      return 'customer-1'
    },
    async updateCustomerContacts() {},
    async fetchExistingPet() {
      return null
    },
    async createPet() {
      return 'pet-1'
    },
    async createAppointment() {
      throw new Error('should not create appointment')
    },
    async validateAppointmentConflict() {
      return { ok: true }
    },
    async insertAppointmentMenus() {},
    createCancelToken() {
      return 'token'
    },
    createGroupCancelToken() {
      return 'group-token'
    },
  }

  await assert.rejects(
    () =>
      createPublicReservationCore({
        storeId: 'store-1',
        input: {
          customerName: '山田 太郎',
          phoneNumber: '09000000000',
          email: 'user@example.com',
          petName: 'ポチ',
          petBreed: '柴犬',
          petGender: 'male',
          preferredStart: '2026-03-01T10:00',
          notes: '',
          qrPayloadText: '',
          menuIds: ['menu-1'],
        },
        requestOrigin: 'https://example.com',
        deps,
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('選択された時間は公開枠ルール外か、すでに利用できません。')
  )
})
