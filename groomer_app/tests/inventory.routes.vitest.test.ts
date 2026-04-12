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

function createAuthOnlySupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(_table: string) {
      throw new Error('Unexpected table')
    },
  }
}

function createInventoryExportSupabaseMock() {
  return {
    from(table: string) {
      if (table === 'inventory_items') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order: async () => ({
                data: [
                  {
                    id: 'item-1',
                    name: 'シャンプー',
                    category: '用品',
                    unit: '本',
                    supplier_name: '仕入先A',
                    optimal_stock: 5,
                    is_active: true,
                  },
                ],
                error: null,
              }),
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
              in: async () => ({
                data: [{ item_id: 'item-1', quantity_delta: 2 }],
                error: null,
              }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
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

  // TRACE-245
  it('POST /api/inventory/purchase-orders returns 400 when supplier_name is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAuthOnlySupabaseMock(),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/inventory/purchase-orders/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/inventory/purchase-orders', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '仕入先は必須です。' })
  })

  // TRACE-246
  it('POST /api/inventory/purchase-orders/[order_id] returns 405 for unsupported _method', async () => {
    const { POST } = await import('../src/app/api/inventory/purchase-orders/[order_id]/route')
    const form = new FormData()
    form.set('_method', 'patchx')
    const response = await POST(
      new Request('http://localhost/api/inventory/purchase-orders/order-1', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ order_id: 'order-1' }) }
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-247
  it('POST /api/inventory/purchase-orders/[order_id]/items returns 400 for non-positive quantity', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAuthOnlySupabaseMock(),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/inventory/purchase-orders/[order_id]/items/route')
    const form = new FormData()
    form.set('item_name', 'シャンプー')
    form.set('quantity', '0')
    form.set('unit_cost', '100')
    const response = await POST(
      new Request('http://localhost/api/inventory/purchase-orders/order-1/items', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ order_id: 'order-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '数量は0より大きい値を指定してください。' })
  })

  // TRACE-248
  it('POST /api/inventory/purchase-orders/draft-from-suggestions returns 400 when no item is selected', async () => {
    const { POST } = await import('../src/app/api/inventory/purchase-orders/draft-from-suggestions/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/inventory/purchase-orders/draft-from-suggestions', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '提案対象が選択されていません。' })
  })

  // TRACE-249
  it('GET /api/inventory/stocks/export returns csv with expected headers', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createInventoryExportSupabaseMock(),
      storeId: 'store-1',
    })
    const { GET } = await import('../src/app/api/inventory/stocks/export/route')
    const response = await GET()
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(csv).toContain('商品名,カテゴリ,単位,仕入先,現在庫,適正在庫,状態')
    expect(csv).toContain('シャンプー,用品,本,仕入先A,2,5,不足')
  })

  // TRACE-382
  it('POST /api/inventory/items/[item_id] returns 405 for unsupported method', async () => {
    const { POST } = await import('../src/app/api/inventory/items/[item_id]/route')
    const form = new FormData()
    form.set('_method', 'patchx')
    const response = await POST(
      new Request('http://localhost/api/inventory/items/item-1', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ item_id: 'item-1' }) }
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-383
  it('POST /api/inventory/purchase-order-items/[line_id] returns 405 for unsupported method', async () => {
    const { POST } = await import('../src/app/api/inventory/purchase-order-items/[line_id]/route')
    const form = new FormData()
    form.set('_method', 'patch')
    const response = await POST(
      new Request('http://localhost/api/inventory/purchase-order-items/line-1', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ line_id: 'line-1' }) }
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-384
  it('GET /api/inventory/reorder-suggestions returns 500 when query fails', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        from(table: string) {
          if (table !== 'inventory_reorder_suggestion_v') {
            throw new Error(`Unexpected table: ${table}`)
          }
          return {
            select() {
              return {
                eq() {
                  return this
                },
                order: async () => ({ data: null, error: { message: 'reorder query failed' } }),
              }
            },
          }
        },
      },
    })
    const { GET } = await import('../src/app/api/inventory/reorder-suggestions/route')
    const response = await GET(new Request('http://localhost/api/inventory/reorder-suggestions'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'reorder query failed' })
  })
})
