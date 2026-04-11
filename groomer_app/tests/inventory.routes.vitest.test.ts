import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

function createInventorySupabaseMock(options?: {
  movementList?: Array<Record<string, unknown>>
}) {
  const movementList =
    options?.movementList ??
    [
      {
        id: 'move-1',
        item_id: 'item-1',
        movement_type: 'inbound',
        reason: '入庫',
        quantity_delta: 5,
      },
    ]

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'inventory_items') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
            }
          },
        }
      }

      if (table === 'inventory_movements') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
              limit() {
                return this
              },
              then(resolve: (result: { data: unknown; error: null }) => unknown) {
                return Promise.resolve(resolve({ data: movementList, error: null }))
              },
            }
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'movement-created-1',
                      item_id: 'item-1',
                      movement_type: 'inbound',
                      quantity_delta: 1,
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function createStockQuerySupabaseMock(currentRows: Array<{ quantity_delta: number }>) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'inventory_movements') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return this
            },
            then(resolve: (result: { data: Array<{ quantity_delta: number }>; error: null }) => unknown) {
              return Promise.resolve(resolve({ data: currentRows, error: null }))
            },
          }
        },
        insert() {
          return {
            select() {
              return {
                single: async () => ({
                  data: {
                    id: 'movement-created-1',
                    item_id: 'item-1',
                    movement_type: 'stocktake_adjustment',
                    quantity_delta: 1,
                  },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  }
}

describe('inventory routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createInventorySupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-133
  it('POST /api/inventory/items returns 400 when name is missing', async () => {
    const { POST } = await import('../src/app/api/inventory/items/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/inventory/items', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '商品名は必須です。' })
  })

  // TRACE-134
  it('POST /api/inventory/movements returns 400 when outbound quantity exceeds current stock', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStockQuerySupabaseMock([{ quantity_delta: 1 }]),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/inventory/movements/route')
    const form = new FormData()
    form.set('item_id', 'item-1')
    form.set('movement_type', 'outbound')
    form.set('quantity', '2')
    const response = await POST(
      new Request('http://localhost/api/inventory/movements', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '在庫不足です。現在庫: 1 / 出庫要求: 2' })
  })

  // TRACE-135
  it('POST /api/inventory/stocktake redirects when actual quantity equals current stock', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStockQuerySupabaseMock([{ quantity_delta: 3 }]),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/inventory/stocktake/route')
    const form = new FormData()
    form.set('item_id', 'item-1')
    form.set('actual_quantity', '3')
    const response = await POST(
      new Request('http://localhost/api/inventory/stocktake', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/inventory/stocktake')
  })

  // TRACE-136
  it('GET /api/inventory/movements returns movement list', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createInventorySupabaseMock({
        movementList: [
          {
            id: 'move-1',
            item_id: 'item-1',
            movement_type: 'inbound',
            reason: '仕入',
            quantity_delta: 2,
          },
        ],
      }),
      storeId: 'store-1',
    })
    const { GET } = await import('../src/app/api/inventory/movements/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      {
        id: 'move-1',
        item_id: 'item-1',
        movement_type: 'inbound',
        reason: '仕入',
        quantity_delta: 2,
      },
    ])
  })
})
