import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPosInventoryMovements, filterNotYetAppliedPosMovements } from '../src/lib/pos/inventory.ts'

test('buildPosInventoryMovements: confirm creates outbound note per line', () => {
  const movements = buildPosInventoryMovements({
    storeId: 'store-1',
    orderId: 'order-1',
    happenedAt: '2026-03-25T00:00:00.000Z',
    createdBy: 'user-1',
    direction: 'confirm',
    lines: [
      { id: 'line-1', source_id: 'item-1', quantity: 2 },
      { id: 'line-2', source_id: 'item-2', quantity: 1 },
    ],
  })

  assert.equal(movements.length, 2)
  assert.equal(movements[0]?.movement_type, 'outbound')
  assert.equal(movements[0]?.quantity_delta, -2)
  assert.equal(movements[0]?.notes, 'POS_OUTBOUND:order-1:line-1')
})

test('filterNotYetAppliedPosMovements: duplicated notes are excluded', () => {
  const movements = buildPosInventoryMovements({
    storeId: 'store-1',
    orderId: 'order-2',
    happenedAt: '2026-03-25T00:00:00.000Z',
    createdBy: 'user-1',
    direction: 'void',
    lines: [{ id: 'line-1', source_id: 'item-1', quantity: 1 }],
  })
  const filtered = filterNotYetAppliedPosMovements(movements, ['POS_VOID_REVERT:order-2:line-1'])

  assert.equal(filtered.length, 0)
})
