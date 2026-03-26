import { toNumber } from '@/lib/inventory/stock'

type PosInventoryLine = {
  id: string
  source_id: string | null
  quantity: number
}

type PosInventoryDirection = 'confirm' | 'void'

type PosInventoryMovementInput = {
  storeId: string
  orderId: string
  happenedAt: string
  createdBy: string | null
  direction: PosInventoryDirection
  lines: PosInventoryLine[]
}

type PosMovementPayload = {
  store_id: string
  item_id: string
  movement_type: 'inbound' | 'outbound'
  reason: string
  quantity_delta: number
  happened_at: string
  notes: string
  created_by: string | null
}

export function toPosInventoryMovementNote(params: {
  direction: PosInventoryDirection
  orderId: string
  lineId: string
}) {
  const action = params.direction === 'confirm' ? 'OUTBOUND' : 'VOID_REVERT'
  return `POS_${action}:${params.orderId}:${params.lineId}`
}

export function buildPosInventoryMovements(input: PosInventoryMovementInput): PosMovementPayload[] {
  const base = input.direction === 'confirm'
    ? { movementType: 'outbound' as const, reason: '店販売上', sign: -1 }
    : { movementType: 'inbound' as const, reason: 'POS取消戻し', sign: 1 }

  return input.lines
    .filter((line) => Boolean(line.source_id) && toNumber(line.quantity) > 0)
    .map((line) => ({
      store_id: input.storeId,
      item_id: line.source_id as string,
      movement_type: base.movementType,
      reason: base.reason,
      quantity_delta: base.sign * Math.abs(toNumber(line.quantity)),
      happened_at: input.happenedAt,
      notes: toPosInventoryMovementNote({
        direction: input.direction,
        orderId: input.orderId,
        lineId: line.id,
      }),
      created_by: input.createdBy,
    }))
}

export function filterNotYetAppliedPosMovements(
  movements: PosMovementPayload[],
  existingNotes: Iterable<string>
): PosMovementPayload[] {
  const existing = new Set(existingNotes)
  return movements.filter((movement) => !existing.has(movement.notes))
}
