import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStayItemSnapshots,
  parseSelectedStayItems,
  sumStayItemAmount,
  summarizeCapacityTimeline,
} from '../src/lib/hotel/stay-items.ts'

test('parseSelectedStayItems ignores invalid rows and normalizes quantity', () => {
  const items = parseSelectedStayItems([
    { menu_item_id: 'item-a', quantity: 2 },
    { menu_item_id: '', quantity: 5 },
    null,
    { menu_item_id: 'item-b' },
  ])

  assert.deepEqual(items, [
    { menu_item_id: 'item-a', quantity: 2, notes: null },
    { menu_item_id: 'item-b', quantity: 1, notes: null },
  ])
})

test('buildStayItemSnapshots creates snapshot rows and totals', () => {
  const rows = buildStayItemSnapshots({
    storeId: 'store-1',
    stayId: 'stay-1',
    nights: 2,
    menuItems: [
      {
        id: 'item-a',
        name: '1泊',
        item_type: 'overnight',
        billing_unit: 'per_night',
        duration_minutes: null,
        default_quantity: 1,
        price: 4500,
        tax_rate: 0.1,
        tax_included: true,
        counts_toward_capacity: true,
        is_active: true,
        display_order: 1,
        notes: null,
      },
      {
        id: 'item-b',
        name: '6時間',
        item_type: 'time_pack',
        billing_unit: 'fixed',
        duration_minutes: 360,
        default_quantity: 1,
        price: 3000,
        tax_rate: 0.1,
        tax_included: true,
        counts_toward_capacity: true,
        is_active: true,
        display_order: 2,
        notes: null,
      },
    ],
    selections: [
      { menu_item_id: 'item-a', quantity: 2 },
      { menu_item_id: 'item-b', quantity: 1 },
    ],
  })

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.line_amount_jpy, 9000)
  assert.equal(rows[0]?.quantity, 2)
  assert.equal(rows[1]?.line_amount_jpy, 3000)
  assert.equal(sumStayItemAmount(rows), 12000)
})

test('summarizeCapacityTimeline detects peak occupancy', () => {
  const summary = summarizeCapacityTimeline(
    [
      {
        id: 'stay-1',
        status: 'reserved',
        planned_check_in_at: '2026-06-10T01:00:00.000Z',
        planned_check_out_at: '2026-06-10T04:00:00.000Z',
      },
      {
        id: 'stay-2',
        status: 'reserved',
        planned_check_in_at: '2026-06-10T02:00:00.000Z',
        planned_check_out_at: '2026-06-10T05:00:00.000Z',
      },
      {
        id: 'stay-3',
        status: 'reserved',
        planned_check_in_at: '2026-06-10T03:00:00.000Z',
        planned_check_out_at: '2026-06-10T06:00:00.000Z',
      },
    ],
    2
  )

  assert.equal(summary.peak, 3)
  assert.equal(summary.exceeded, true)
})
