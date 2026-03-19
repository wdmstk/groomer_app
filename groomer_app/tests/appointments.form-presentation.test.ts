import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAppointmentConflictMessage,
  buildCreatedAppointmentSummary,
  formatAppointmentFormDateTimeJst,
  selectLatestReservableTemplate,
} from '../src/lib/appointments/form-presentation.ts'

test('appointment form helpers build conflict message with JST range', () => {
  const message = buildAppointmentConflictMessage({
    message: '同じスタッフに時間が重複する予約があります。',
    conflict: {
      startTime: '2026-03-16T01:00:00.000Z',
      endTime: '2026-03-16T02:30:00.000Z',
    },
  })

  assert.match(message, /衝突: 03\/16 10:00 - 03\/16 11:30/)
  assert.equal(formatAppointmentFormDateTimeJst('bad-value'), '-')
})

test('appointment form helpers select latest valid template for same pet', () => {
  const template = selectLatestReservableTemplate({
    templates: [
      {
        id: 'cancelled',
        customer_id: 'cust-1',
        pet_id: 'pet-1',
        staff_id: 'staff-1',
        start_time: '2026-03-10T01:00:00.000Z',
        end_time: '2026-03-10T02:00:00.000Z',
        notes: null,
        menu_ids: ['m1'],
        duration: 60,
        status: 'キャンセル',
      },
      {
        id: 'older',
        customer_id: 'cust-1',
        pet_id: 'pet-1',
        staff_id: 'staff-1',
        start_time: '2026-03-11T01:00:00.000Z',
        end_time: '2026-03-11T02:00:00.000Z',
        notes: null,
        menu_ids: ['m1'],
        duration: 60,
        status: '完了',
      },
      {
        id: 'latest',
        customer_id: 'cust-1',
        pet_id: 'pet-1',
        staff_id: 'staff-2',
        start_time: '2026-03-15T01:00:00.000Z',
        end_time: '2026-03-15T02:30:00.000Z',
        notes: '臆病',
        menu_ids: ['m1', 'm2'],
        duration: 90,
        status: '来店済',
      },
    ],
    selectedCustomerId: 'cust-1',
    selectedPetId: 'pet-1',
  })

  assert.equal(template?.id, 'latest')
  assert.deepEqual(template?.menu_ids, ['m1', 'm2'])
})

test('appointment form helpers build created summary for family booking continuation', () => {
  const summary = buildCreatedAppointmentSummary({
    payload: {
      id: 'appt-2',
      groupId: 'group-1',
      appointment: {
        id: 'appt-2',
        group_id: 'group-1',
        customer_id: 'cust-1',
        pet_id: 'pet-2',
        start_time: '2026-03-20T01:00:00.000Z',
        menu: 'シャンプー / 部分カット',
      },
    },
    currentGroupId: '',
    selectedCustomerId: 'cust-1',
    selectedPetId: 'pet-2',
    startTime: '2026-03-20T10:00',
    selectedMenuIds: ['m1', 'm2'],
    menuOptions: [
      { id: 'm1', name: 'シャンプー' },
      { id: 'm2', name: '部分カット' },
    ],
    customerList: [{ id: 'cust-1', full_name: '佐藤 愛' }],
    petList: [{ id: 'pet-2', name: 'こむぎ' }],
    nowId: 'fallback-id',
  })

  assert.deepEqual(summary, {
    id: 'appt-2',
    groupId: 'group-1',
    customerId: 'cust-1',
    petId: 'pet-2',
    customerName: '佐藤 愛',
    petName: 'こむぎ',
    startTime: '2026-03-20T01:00:00.000Z',
    menuSummary: 'シャンプー / 部分カット',
  })
})
