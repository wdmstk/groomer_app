import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireOwnerStoreMembershipMock,
  canPurchaseOptionsByPlanMock,
  fetchStorePlanOptionStateMock,
  createAdminSupabaseClientMock,
  applyRequestedOptionEntitlementsMock,
  isDevBillingBypassEnabledMock,
  updateStoreSubscriptionStatusMock,
  findLatestBillingSubscriptionByStoreAndProviderMock,
  insertBillingOperationMock,
  updateSubscriptionStatusByProviderSubscriptionIdMock,
  cancelStripeSubscriptionMock,
  cancelKomojuSubscriptionMock,
} = vi.hoisted(() => ({
  requireOwnerStoreMembershipMock: vi.fn(),
  canPurchaseOptionsByPlanMock: vi.fn(),
  fetchStorePlanOptionStateMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  applyRequestedOptionEntitlementsMock: vi.fn(),
  isDevBillingBypassEnabledMock: vi.fn(),
  updateStoreSubscriptionStatusMock: vi.fn(),
  findLatestBillingSubscriptionByStoreAndProviderMock: vi.fn(),
  insertBillingOperationMock: vi.fn(),
  updateSubscriptionStatusByProviderSubscriptionIdMock: vi.fn(),
  cancelStripeSubscriptionMock: vi.fn(),
  cancelKomojuSubscriptionMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-owner', () => ({
  requireOwnerStoreMembership: requireOwnerStoreMembershipMock,
}))

vi.mock('@/lib/subscription-plan', () => ({
  canPurchaseOptionsByPlan: canPurchaseOptionsByPlanMock,
}))

vi.mock('@/lib/store-plan-options', () => ({
  asStorePlanOptionsClient: (client: unknown) => client,
  fetchStorePlanOptionState: fetchStorePlanOptionStateMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/billing/db', () => ({
  applyRequestedOptionEntitlements: applyRequestedOptionEntitlementsMock,
  updateStoreSubscriptionStatus: updateStoreSubscriptionStatusMock,
  findLatestBillingSubscriptionByStoreAndProvider: findLatestBillingSubscriptionByStoreAndProviderMock,
  insertBillingOperation: insertBillingOperationMock,
  updateSubscriptionStatusByProviderSubscriptionId: updateSubscriptionStatusByProviderSubscriptionIdMock,
}))

vi.mock('@/lib/billing/dev-bypass', () => ({
  isDevBillingBypassEnabled: isDevBillingBypassEnabledMock,
}))

vi.mock('@/lib/billing/providers', () => ({
  cancelStripeSubscription: cancelStripeSubscriptionMock,
  cancelKomojuSubscription: cancelKomojuSubscriptionMock,
}))

function createAdminClient(updateError: { message: string } | null = null) {
  const eqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  return { from: fromMock, updateMock, eqMock }
}

describe('billing routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    requireOwnerStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'owner-1' },
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: { billing_status: 'active' }, error: null }),
          }),
        })),
      },
    })

    canPurchaseOptionsByPlanMock.mockReturnValue(true)
    fetchStorePlanOptionStateMock.mockResolvedValue({
      planCode: 'standard',
      aiPlanCode: 'none',
      hotelOptionEnabled: false,
      notificationOptionEnabled: false,
    })
    isDevBillingBypassEnabledMock.mockReturnValue(false)
    applyRequestedOptionEntitlementsMock.mockResolvedValue(undefined)

    updateStoreSubscriptionStatusMock.mockResolvedValue(undefined)
    findLatestBillingSubscriptionByStoreAndProviderMock.mockResolvedValue({
      provider_subscription_id: 'sub_123',
    })
    insertBillingOperationMock.mockResolvedValue(undefined)
    updateSubscriptionStatusByProviderSubscriptionIdMock.mockResolvedValue(undefined)
    cancelStripeSubscriptionMock.mockResolvedValue(undefined)
    cancelKomojuSubscriptionMock.mockResolvedValue(undefined)
  })

  // TRACE-160
  it('POST /api/billing/options returns membership guard error response', async () => {
    requireOwnerStoreMembershipMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'forbidden',
    })
    const { POST } = await import('../src/app/api/billing/options/route')

    const response = await POST(new Request('http://localhost/api/billing/options', { method: 'POST' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: 'forbidden' })
  })

  // TRACE-161
  it('POST /api/billing/options rejects option enable on unsupported plan', async () => {
    canPurchaseOptionsByPlanMock.mockReturnValueOnce(false)
    const admin = createAdminClient(null)
    createAdminSupabaseClientMock.mockReturnValueOnce({ from: admin.from })

    const { POST } = await import('../src/app/api/billing/options/route')
    const form = new FormData()
    form.set('option', 'hotel')
    form.set('hotel_option_enabled', 'true')

    const response = await POST(
      new Request('http://localhost/api/billing/options', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    const location = decodeURIComponent(response.headers.get('location') ?? '')
    expect(location).toContain('/billing?error=')
    expect(location).toContain('オプション契約はスタンダード以上のプランでのみ有効化できます。')
    expect(admin.from).not.toHaveBeenCalled()
  })

  // TRACE-162
  it('POST /api/billing/options returns migration guidance when requested column is missing', async () => {
    const admin = createAdminClient({ message: "Could not find column 'hotel_option_requested'" })
    createAdminSupabaseClientMock.mockReturnValueOnce({ from: admin.from })

    const { POST } = await import('../src/app/api/billing/options/route')
    const form = new FormData()
    form.set('option', 'hotel')
    form.set('hotel_option_enabled', 'true')

    const response = await POST(
      new Request('http://localhost/api/billing/options', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    const location = decodeURIComponent(response.headers.get('location') ?? '')
    expect(location).toContain('/billing?error=')
    expect(location).toContain('課金ゲート移行用のDBマイグレーションが未適用です。')
  })

  // TRACE-163
  it('POST /api/billing/preferred-provider rejects unsupported provider', async () => {
    const { POST } = await import('../src/app/api/billing/preferred-provider/route')

    const response = await POST(
      new Request('http://localhost/api/billing/preferred-provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'paypal' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'provider must be stripe or komoju.' })
  })

  // TRACE-164
  it('POST /api/billing/preferred-provider falls back to trialing when current status is invalid', async () => {
    requireOwnerStoreMembershipMock.mockResolvedValueOnce({
      ok: true,
      storeId: 'store-1',
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: { billing_status: 'unknown_status' }, error: null }),
          }),
        })),
      },
    })

    const { POST } = await import('../src/app/api/billing/preferred-provider/route')
    const response = await POST(
      new Request('http://localhost/api/billing/preferred-provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe' }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateStoreSubscriptionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        status: 'trialing',
        provider: 'stripe',
      })
    )
  })

  // TRACE-165
  it('POST /api/billing/subscription/actions rejects invalid action', async () => {
    const { POST } = await import('../src/app/api/billing/subscription/actions/route')

    const response = await POST(
      new Request('http://localhost/api/billing/subscription/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe', action: 'pause_now' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'invalid action.' })
  })

  // TRACE-166
  it('POST /api/billing/subscription/actions returns 404 when target subscription is missing', async () => {
    findLatestBillingSubscriptionByStoreAndProviderMock.mockResolvedValueOnce(null)
    const { POST } = await import('../src/app/api/billing/subscription/actions/route')

    const response = await POST(
      new Request('http://localhost/api/billing/subscription/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'komoju', action: 'cancel_at_period_end' }),
      })
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '対象サブスクが見つかりません。' })
  })

  // TRACE-167
  it('POST /api/billing/subscription/actions logs refund request and returns success', async () => {
    const { POST } = await import('../src/app/api/billing/subscription/actions/route')

    const response = await POST(
      new Request('http://localhost/api/billing/subscription/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe', action: 'refund_request', amount_jpy: 999 }),
      })
    )

    expect(response.status).toBe(200)
    expect(insertBillingOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'refund_request',
        amountJpy: 999,
      })
    )
    await expect(response.json()).resolves.toEqual({ message: '返金依頼を記録しました。' })
  })

  // TRACE-168
  it('POST /api/billing/subscription/actions executes immediate cancellation flow', async () => {
    const { POST } = await import('../src/app/api/billing/subscription/actions/route')

    const response = await POST(
      new Request('http://localhost/api/billing/subscription/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe', action: 'cancel_immediately' }),
      })
    )

    expect(cancelStripeSubscriptionMock).toHaveBeenCalledWith({
      subscriptionId: 'sub_123',
      immediately: true,
    })
    expect(updateSubscriptionStatusByProviderSubscriptionIdMock).toHaveBeenCalled()
    expect(updateStoreSubscriptionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        provider: 'stripe',
        status: 'canceled',
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: '即時解約を実行しました。' })
  })
})
