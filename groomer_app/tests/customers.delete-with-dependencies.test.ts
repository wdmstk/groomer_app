import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deleteCustomerWithDependencies,
  deletePetWithDependencies,
} from '../src/lib/customers/services/delete.ts'

type QueryResult = {
  data?: Array<{ id: string }>
  error: { message: string } | null
}

type Filter = {
  type: 'eq'
  column: string
  value: unknown
}

class QueryBuilderMock {
  filters: Filter[] = []
  private readonly table: string
  private readonly action: 'select' | 'update' | 'delete'
  private readonly state: MockState

  constructor(table: string, action: 'select' | 'update' | 'delete', state: MockState) {
    this.table = table
    this.action = action
    this.state = state
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.state.handle(this)).then(resolve, reject)
  }

  describe() {
    return {
      table: this.table,
      action: this.action,
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

  select(_columns: string) {
    return new QueryBuilderMock(this.table, 'select', this.state)
  }

  update(_payload: unknown) {
    return new QueryBuilderMock(this.table, 'update', this.state)
  }

  delete() {
    return new QueryBuilderMock(this.table, 'delete', this.state)
  }
}

class MockState {
  operations: Array<ReturnType<QueryBuilderMock['describe']>> = []
  private readonly petsByCustomerId: Record<string, Array<{ id: string }>>
  private readonly appointmentsByPetId: Record<string, Array<{ id: string }>>
  private readonly appointmentsByCustomerId: Record<string, Array<{ id: string }>>
  private readonly recordsByPetId: Record<string, Array<{ id: string }>>

  constructor(params?: {
    petsByCustomerId?: Record<string, Array<{ id: string }>>
    appointmentsByPetId?: Record<string, Array<{ id: string }>>
    appointmentsByCustomerId?: Record<string, Array<{ id: string }>>
    recordsByPetId?: Record<string, Array<{ id: string }>>
  }) {
    this.petsByCustomerId = params?.petsByCustomerId ?? {}
    this.appointmentsByPetId = params?.appointmentsByPetId ?? {}
    this.appointmentsByCustomerId = params?.appointmentsByCustomerId ?? {}
    this.recordsByPetId = params?.recordsByPetId ?? {}
  }

  from(table: string) {
    return new TableMock(table, this)
  }

  handle(query: QueryBuilderMock): QueryResult {
    const op = query.describe()
    this.operations.push(op)

    if (op.action !== 'select') {
      return { error: null }
    }

    const customerId = op.filters.find((filter) => filter.column === 'customer_id')?.value
    const petId = op.filters.find((filter) => filter.column === 'pet_id')?.value

    if (op.table === 'pets' && typeof customerId === 'string') {
      return { data: this.petsByCustomerId[customerId] ?? [], error: null }
    }
    if (op.table === 'appointments' && typeof petId === 'string') {
      return { data: this.appointmentsByPetId[petId] ?? [], error: null }
    }
    if (op.table === 'appointments' && typeof customerId === 'string') {
      return { data: this.appointmentsByCustomerId[customerId] ?? [], error: null }
    }
    if (op.table === 'medical_records' && typeof petId === 'string') {
      return { data: this.recordsByPetId[petId] ?? [], error: null }
    }
    return { data: [], error: null }
  }
}

test('deletePetWithDependencies deletes related appointment and medical record data before pet delete', async () => {
  const state = new MockState({
    appointmentsByPetId: {
      'pet-1': [{ id: 'appt-1' }, { id: 'appt-2' }],
    },
    recordsByPetId: {
      'pet-1': [{ id: 'record-1' }],
    },
  })
  const deletedAppointments: string[] = []
  const deletedRecords: string[] = []

  const result = await deletePetWithDependencies({
    supabase: state as never,
    storeId: 'store-1',
    petId: 'pet-1',
    deps: {
      deleteAppointmentById: async ({ appointmentId }) => {
        deletedAppointments.push(appointmentId)
        return { success: true as const }
      },
      deleteMedicalRecordById: async ({ recordId }) => {
        deletedRecords.push(recordId)
        return { success: true as const }
      },
    },
  })

  assert.deepEqual(result, { success: true })
  assert.deepEqual(deletedAppointments, ['appt-1', 'appt-2'])
  assert.deepEqual(deletedRecords, ['record-1'])
  assert.ok(
    state.operations.some((operation) => operation.action === 'delete' && operation.table === 'hotel_stays')
  )
  assert.ok(state.operations.some((operation) => operation.action === 'delete' && operation.table === 'pets'))
})

test('deleteCustomerWithDependencies deletes pets first and then customer records', async () => {
  const state = new MockState({
    petsByCustomerId: {
      'customer-1': [{ id: 'pet-1' }],
    },
    appointmentsByPetId: {
      'pet-1': [{ id: 'appt-pet-1' }],
    },
    appointmentsByCustomerId: {
      'customer-1': [{ id: 'appt-customer-1' }],
    },
    recordsByPetId: {
      'pet-1': [{ id: 'record-pet-1' }],
    },
  })
  const deletedAppointments: string[] = []
  const deletedRecords: string[] = []

  const result = await deleteCustomerWithDependencies({
    supabase: state as never,
    storeId: 'store-1',
    customerId: 'customer-1',
    deps: {
      deleteAppointmentById: async ({ appointmentId }) => {
        deletedAppointments.push(appointmentId)
        return { success: true as const }
      },
      deleteMedicalRecordById: async ({ recordId }) => {
        deletedRecords.push(recordId)
        return { success: true as const }
      },
    },
  })

  assert.deepEqual(result, { success: true })
  assert.deepEqual(deletedAppointments, ['appt-pet-1', 'appt-customer-1'])
  assert.deepEqual(deletedRecords, ['record-pet-1'])
  assert.ok(state.operations.some((operation) => operation.action === 'delete' && operation.table === 'invoices'))
  assert.ok(state.operations.some((operation) => operation.action === 'delete' && operation.table === 'customers'))
})
