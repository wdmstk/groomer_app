import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatAppointmentDateTimeJst,
  getAppointmentNextStatusAction,
  getAppointmentRelatedValue,
  getAppointmentStatusTransitionTime,
  isAppointmentCompletedStatus,
} from '../src/lib/appointments/presentation.ts'

test('appointment list presentation helpers format realistic reservation data', () => {
  const display = formatAppointmentDateTimeJst('2026-03-16T01:30:00.000Z')
  assert.equal(display, '2026/03/16 10:30')

  const customerName = getAppointmentRelatedValue([{ full_name: '山田 花子' }], 'full_name')
  const petName = getAppointmentRelatedValue({ name: 'モカ' }, 'name')

  assert.equal(customerName, '山田 花子')
  assert.equal(petName, 'モカ')
})

test('appointment list presentation helpers fallback to 未登録 for missing values', () => {
  assert.equal(formatAppointmentDateTimeJst('invalid-date'), '未登録')
  assert.equal(getAppointmentRelatedValue(null, 'name' as never), '未登録')
})

test('appointment list presentation helpers map status actions and completion states', () => {
  assert.deepEqual(getAppointmentNextStatusAction('予約済'), {
    nextStatus: '受付',
    label: '受付開始',
  })
  assert.equal(getAppointmentNextStatusAction('予約申請'), null)
  assert.equal(isAppointmentCompletedStatus('完了'), true)
  assert.equal(isAppointmentCompletedStatus('無断キャンセル'), false)
})

test('appointment list presentation helpers expose transition timestamps for progress rows', () => {
  assert.deepEqual(
    getAppointmentStatusTransitionTime('施術中', {
      checked_in_at: '2026-03-16T01:00:00.000Z',
      in_service_at: '2026-03-16T01:20:00.000Z',
      payment_waiting_at: null,
      completed_at: null,
    }),
    {
      label: '施術開始',
      value: '2026-03-16T01:20:00.000Z',
    }
  )

  assert.deepEqual(
    getAppointmentStatusTransitionTime('完了', {
      completed_at: '2026-03-16T03:00:00.000Z',
    }),
    {
      label: '完了',
      value: '2026-03-16T03:00:00.000Z',
    }
  )
})
