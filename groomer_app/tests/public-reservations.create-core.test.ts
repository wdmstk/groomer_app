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
      assert.equal(params.menuSummaryNames, 'シャンプー')
      assert.equal(params.duration, 60)
      assert.equal(params.notes, '顧客Web申請: 初回です')
      assert.equal(params.startTimeIso, '2026-03-01T01:00:00.000Z')
      assert.equal(params.endTimeIso, '2026-03-01T02:00:00.000Z')
      return 'appointment-1'
    },
    async insertAppointmentMenus({ storeId, appointmentId, menus }) {
      calls.push('insertAppointmentMenus')
      appointmentMenus.push({ storeId, appointmentId, menuCount: menus.length })
    },
    createCancelToken({ appointmentId, storeId }) {
      return `${storeId}:${appointmentId}`
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
  assert.equal(
    result.cancelUrl,
    'https://example.com/reserve/cancel?token=store-1%3Aappointment-1'
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
    'createAppointment',
    'insertAppointmentMenus',
  ])
})
