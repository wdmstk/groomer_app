import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteAppointment } from '../src/lib/appointments/services/delete.ts'
import { AppointmentServiceError } from '../src/lib/appointments/services/shared.ts'

type QueryResult = {
  data?: unknown
  count?: number | null
  error?: { message: string } | null
}

class QueryBuilderMock {
  filters: Array<{ type: 'eq' | 'in'; column: string; value: unknown }> = []
  private readonly table: string
  private readonly action: 'select' | 'update' | 'delete'
  private readonly state: MockState
  private readonly payload?: unknown

  constructor(table: string, action: 'select' | 'update' | 'delete', state: MockState, payload?: unknown) {
    this.table = table
    this.action = action
    this.state = state
    this.payload = payload
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  in(column: string, value: unknown) {
    this.filters.push({ type: 'in', column, value })
    return this
  }

  then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.state.handle(this)).then(resolve, reject)
  }

  describe() {
    return {
      table: this.table,
      action: this.action,
      payload: this.payload,
      filters: this.filters,
    }
  }
}

class TableMock {
  private readonly table: string
  private readonly state: MockState

  constructor(table: string, state: MockState) {
    this.table = table
    this.state = state
  }

  select(_columns: string, _options?: unknown) {
    return new QueryBuilderMock(this.table, 'select', this.state)
  }

  update(payload: unknown) {
    return new QueryBuilderMock(this.table, 'update', this.state, payload)
  }

  delete() {
    return new QueryBuilderMock(this.table, 'delete', this.state)
  }
}

class MockState {
  operations: Array<ReturnType<QueryBuilderMock['describe']>> = []
  private readonly counts: Record<string, number>
  private readonly rows: Record<string, unknown[]>

  constructor(counts: Record<string, number> = {}, rows: Record<string, unknown[]> = {}) {
    this.counts = counts
    this.rows = rows
  }

  from(table: string) {
    return new TableMock(table, this)
  }

  handle(query: QueryBuilderMock): QueryResult {
    const operation = query.describe()
    this.operations.push(operation)

    if (operation.action === 'select') {
      if (operation.table === 'slot_reoffers') {
        return { data: this.rows.slot_reoffers ?? [], error: null }
      }
      return { count: this.counts[operation.table] ?? 0, error: null }
    }

    return { error: null }
  }
}

test('deleteAppointment clears dependent rows before deleting appointment', async () => {
  const state = new MockState(
    { payments: 0, medical_record_photos: 0 },
    { slot_reoffers: [{ id: 'reoffer-1' }] }
  )

  const result = await deleteAppointment({
    supabase: state as never,
    storeId: 'store-1',
    appointmentId: 'appointment-1',
  })

  assert.deepEqual(result, { success: true })
  assert.deepEqual(
    state.operations.map((operation) => `${operation.action}:${operation.table}`),
    [
      'select:payments',
      'select:medical_record_photos',
      'delete:appointment_menus',
      'update:customer_followup_tasks',
      'update:customer_notification_logs',
      'update:medical_records',
      'update:visits',
      'update:hotel_stays',
      'select:slot_reoffers',
      'update:customer_notification_logs',
      'delete:slot_reoffer_logs',
      'delete:slot_reoffers',
      'delete:appointments',
    ]
  )
})

test('deleteAppointment blocks deletion when payments exist', async () => {
  const state = new MockState({ payments: 1 })

  await assert.rejects(
    () =>
      deleteAppointment({
        supabase: state as never,
        storeId: 'store-1',
        appointmentId: 'appointment-1',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppointmentServiceError)
      assert.equal(error.status, 409)
      assert.match(error.message, /会計データが紐づく予約は削除できません/)
      return true
    }
  )

  assert.deepEqual(
    state.operations.map((operation) => `${operation.action}:${operation.table}`),
    ['select:payments']
  )
})
