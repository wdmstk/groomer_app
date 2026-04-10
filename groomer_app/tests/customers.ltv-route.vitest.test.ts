import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, fetchCustomerLtvSummariesMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  fetchCustomerLtvSummariesMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/customer-ltv', () => ({
  fetchCustomerLtvSummaries: fetchCustomerLtvSummariesMock,
}))

describe('customers/ltv route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: {},
      storeId: 'store-1',
    })
  })

  // TRACE-099
  it('returns LTV rows with 200 when fetch succeeds', async () => {
    fetchCustomerLtvSummariesMock.mockResolvedValue([
      { customer_id: 'customer-1', total_amount: 10000, rank: 'A' },
    ])

    const { GET } = await import('../src/app/api/customers/ltv/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { customer_id: 'customer-1', total_amount: 10000, rank: 'A' },
    ])
    expect(fetchCustomerLtvSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1' })
    )
  })

  // TRACE-100
  it('returns 500 with error message when fetch throws', async () => {
    fetchCustomerLtvSummariesMock.mockRejectedValue(new Error('ltv fetch failed'))

    const { GET } = await import('../src/app/api/customers/ltv/route')
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ message: 'ltv fetch failed' })
  })
})
