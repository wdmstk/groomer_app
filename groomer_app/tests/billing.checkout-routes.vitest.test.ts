import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireOwnerStoreMembershipMock,
  findReusableCheckoutSessionMock,
  findLatestBillingSubscriptionByStoreAndProviderMock,
  findBillingCustomerMock,
  upsertBillingCustomerMock,
  upsertBillingSubscriptionMock,
  createBillingCheckoutSessionLogMock,
  countActiveOwnerStoresMock,
  updateStoreSubscriptionStatusMock,
  applyRequestedOptionEntitlementsMock,
  insertBillingOperationMock,
  createProviderCustomerMock,
  createStripeCheckoutSessionMock,
  createKomojuCheckoutSessionMock,
  createStripeStorageAddonCheckoutSessionMock,
  createKomojuStorageAddonCheckoutSessionMock,
  createStripeOneTimeCheckoutSessionMock,
  createKomojuOneTimeCheckoutSessionMock,
  isDevBillingBypassEnabledMock,
} = vi.hoisted(() => ({
  requireOwnerStoreMembershipMock: vi.fn(),
  findReusableCheckoutSessionMock: vi.fn(),
  findLatestBillingSubscriptionByStoreAndProviderMock: vi.fn(),
  findBillingCustomerMock: vi.fn(),
  upsertBillingCustomerMock: vi.fn(),
  upsertBillingSubscriptionMock: vi.fn(),
  createBillingCheckoutSessionLogMock: vi.fn(),
  countActiveOwnerStoresMock: vi.fn(),
  updateStoreSubscriptionStatusMock: vi.fn(),
  applyRequestedOptionEntitlementsMock: vi.fn(),
  insertBillingOperationMock: vi.fn(),
  createProviderCustomerMock: vi.fn(),
  createStripeCheckoutSessionMock: vi.fn(),
  createKomojuCheckoutSessionMock: vi.fn(),
  createStripeStorageAddonCheckoutSessionMock: vi.fn(),
  createKomojuStorageAddonCheckoutSessionMock: vi.fn(),
  createStripeOneTimeCheckoutSessionMock: vi.fn(),
  createKomojuOneTimeCheckoutSessionMock: vi.fn(),
  isDevBillingBypassEnabledMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-owner', () => ({
  requireOwnerStoreMembership: requireOwnerStoreMembershipMock,
}))

vi.mock('@/lib/billing/db', () => ({
  findReusableCheckoutSession: findReusableCheckoutSessionMock,
  findLatestBillingSubscriptionByStoreAndProvider: findLatestBillingSubscriptionByStoreAndProviderMock,
  findBillingCustomer: findBillingCustomerMock,
  upsertBillingCustomer: upsertBillingCustomerMock,
  upsertBillingSubscription: upsertBillingSubscriptionMock,
  createBillingCheckoutSessionLog: createBillingCheckoutSessionLogMock,
  countActiveOwnerStores: countActiveOwnerStoresMock,
  updateStoreSubscriptionStatus: updateStoreSubscriptionStatusMock,
  applyRequestedOptionEntitlements: applyRequestedOptionEntitlementsMock,
  insertBillingOperation: insertBillingOperationMock,
}))

vi.mock('@/lib/billing/providers', () => ({
  createProviderCustomer: createProviderCustomerMock,
  createStripeCheckoutSession: createStripeCheckoutSessionMock,
  createKomojuCheckoutSession: createKomojuCheckoutSessionMock,
  createStripeStorageAddonCheckoutSession: createStripeStorageAddonCheckoutSessionMock,
  createKomojuStorageAddonCheckoutSession: createKomojuStorageAddonCheckoutSessionMock,
  createStripeOneTimeCheckoutSession: createStripeOneTimeCheckoutSessionMock,
  createKomojuOneTimeCheckoutSession: createKomojuOneTimeCheckoutSessionMock,
}))

vi.mock('@/lib/billing/dev-bypass', () => ({
  isDevBillingBypassEnabled: isDevBillingBypassEnabledMock,
}))

vi.mock('@/lib/subscription-plan', () => ({
  canPurchaseOptionsByPlan: vi.fn(() => true),
  normalizePlanCode: (value: string) => {
    if (value === 'pro') return 'pro'
    if (value === 'standard') return 'standard'
    return 'light'
  },
}))

function createGuard({
  email = 'owner@example.com',
  options = {
    hotel_option_requested: false,
    hotel_option_enabled: false,
    notification_option_requested: false,
    notification_option_enabled: false,
    ai_plan_code_requested: 'none',
    ai_plan_code: 'none',
  },
}: {
  email?: string | null
  options?: Record<string, unknown>
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: options, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return {
    ok: true,
    storeId: 'store-1',
    user: { id: 'user-1', email },
    supabase: { from },
  }
}

describe('billing checkout routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    requireOwnerStoreMembershipMock.mockResolvedValue(createGuard())
    countActiveOwnerStoresMock.mockResolvedValue(1)
    findReusableCheckoutSessionMock.mockResolvedValue(null)
    findLatestBillingSubscriptionByStoreAndProviderMock.mockResolvedValue(null)
    findBillingCustomerMock.mockResolvedValue(null)
    upsertBillingCustomerMock.mockResolvedValue({ id: 'billing-customer-1' })
    upsertBillingSubscriptionMock.mockResolvedValue(undefined)
    createBillingCheckoutSessionLogMock.mockResolvedValue(undefined)
    updateStoreSubscriptionStatusMock.mockResolvedValue(undefined)
    applyRequestedOptionEntitlementsMock.mockResolvedValue(undefined)
    insertBillingOperationMock.mockResolvedValue(undefined)

    createProviderCustomerMock.mockResolvedValue('cus_123')
    createStripeCheckoutSessionMock.mockResolvedValue({ id: 'cs_test_1', url: 'https://stripe.test/checkout', subscription: 'sub_1' })
    createKomojuCheckoutSessionMock.mockResolvedValue({ id: 'ko_test_1', url: 'https://komoju.test/checkout', subscription: 'sub_2' })
    createStripeStorageAddonCheckoutSessionMock.mockResolvedValue({ id: 'cs_addon_1', url: 'https://stripe.test/addon', subscription: 'sub_addon_1' })
    createKomojuStorageAddonCheckoutSessionMock.mockResolvedValue({ id: 'ko_addon_1', url: 'https://komoju.test/addon', subscription: 'sub_addon_2' })
    createStripeOneTimeCheckoutSessionMock.mockResolvedValue({ id: 'cs_setup_1', url: 'https://stripe.test/setup' })
    createKomojuOneTimeCheckoutSessionMock.mockResolvedValue({ id: 'ko_setup_1', url: 'https://komoju.test/setup' })
    isDevBillingBypassEnabledMock.mockReturnValue(false)
  })

  // TRACE-169
  it('POST /api/billing/stripe/checkout returns 400 when owner email is missing', async () => {
    requireOwnerStoreMembershipMock.mockResolvedValueOnce(createGuard({ email: null }))
    const { POST } = await import('../src/app/api/billing/stripe/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan_code: 'standard', billing_cycle: 'monthly' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'User email is required.' })
  })

  // TRACE-170
  it('POST /api/billing/stripe/checkout returns reusable checkout session when exists', async () => {
    findReusableCheckoutSessionMock.mockResolvedValueOnce({
      checkout_url: 'https://stripe.test/reuse',
      checkout_session_id: 'cs_reuse_1',
    })
    const { POST } = await import('../src/app/api/billing/stripe/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan_code: 'standard', billing_cycle: 'monthly' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkout_url: 'https://stripe.test/reuse',
      session_id: 'cs_reuse_1',
      reused: true,
    })
  })

  // TRACE-171
  it('POST /api/billing/komoju/checkout returns 409 when active subscription exists', async () => {
    findLatestBillingSubscriptionByStoreAndProviderMock.mockResolvedValueOnce({
      provider_subscription_id: 'sub_active_1',
      status: 'active',
    })
    const { POST } = await import('../src/app/api/billing/komoju/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/komoju/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan_code: 'standard', billing_cycle: 'monthly' }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: '既存のKOMOJU契約が有効です。プラン変更時は先に「運用操作」から解約手続きを実行してください。',
    })
  })

  // TRACE-172
  it('POST /api/billing/setup-assistance/checkout falls back to stripe for unknown provider', async () => {
    const { POST } = await import('../src/app/api/billing/setup-assistance/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/setup-assistance/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'unknown-provider' }),
      })
    )

    expect(response.status).toBe(200)
    expect(createStripeOneTimeCheckoutSessionMock).toHaveBeenCalledOnce()
    expect(createKomojuOneTimeCheckoutSessionMock).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      checkout_url: 'https://stripe.test/setup',
      session_id: 'cs_setup_1',
    })
  })

  // TRACE-173
  it('POST /api/billing/storage-addon/checkout returns reusable session for storage_addon scope', async () => {
    findReusableCheckoutSessionMock.mockResolvedValueOnce({
      checkout_url: 'https://stripe.test/reuse-addon',
      checkout_session_id: 'cs_addon_reuse_1',
    })
    const { POST } = await import('../src/app/api/billing/storage-addon/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/storage-addon/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe', units: 3 }),
      })
    )

    expect(findReusableCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionScope: 'storage_addon' })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkout_url: 'https://stripe.test/reuse-addon',
      session_id: 'cs_addon_reuse_1',
      reused: true,
    })
  })

  // TRACE-174
  it('POST /api/billing/storage-addon/checkout normalizes invalid units to minimum and returns addon amount', async () => {
    const { POST } = await import('../src/app/api/billing/storage-addon/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/billing/storage-addon/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe', units: 'invalid' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkout_url: 'https://stripe.test/addon',
      session_id: 'cs_addon_1',
      addon_gb: 10,
      amount_jpy: 300,
    })
  })
})
