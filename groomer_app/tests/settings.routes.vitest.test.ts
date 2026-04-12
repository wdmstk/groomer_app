import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  createServerSupabaseClientMock,
  createAdminSupabaseClientMock,
  resolveCurrentStoreIdMock,
  fetchStorePlanOptionStateMock,
  canPurchaseOptionsByPlanMock,
  requireOwnerStoreMembershipMock,
  upsertStoreStoragePolicyMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createServerSupabaseClientMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  resolveCurrentStoreIdMock: vi.fn(),
  fetchStorePlanOptionStateMock: vi.fn(),
  canPurchaseOptionsByPlanMock: vi.fn(),
  requireOwnerStoreMembershipMock: vi.fn(),
  upsertStoreStoragePolicyMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
  resolveCurrentStoreId: resolveCurrentStoreIdMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/store-plan-options', () => ({
  asStorePlanOptionsClient: (client: unknown) => client,
  fetchStorePlanOptionState: fetchStorePlanOptionStateMock,
}))

vi.mock('@/lib/subscription-plan', () => ({
  canPurchaseOptionsByPlan: canPurchaseOptionsByPlanMock,
}))

vi.mock('@/lib/auth/store-owner', () => ({
  requireOwnerStoreMembership: requireOwnerStoreMembershipMock,
}))

vi.mock('@/lib/storage-quota', () => ({
  upsertStoreStoragePolicy: upsertStoreStoragePolicyMock,
}))

function createSettingsSupabase(options?: {
  role?: 'owner' | 'admin' | 'staff' | null
  notificationRow?: Record<string, unknown> | null
  reservationRow?: Record<string, unknown> | null
  notificationUpsertError?: { message: string } | null
  reservationUpsertError?: { message: string } | null
}) {
  const role = options?.role ?? 'owner'
  const notificationUpsertMock = vi.fn(async () => ({ error: options?.notificationUpsertError ?? null }))
  const reservationUpsertMock = vi.fn(async () => ({ error: options?.reservationUpsertError ?? null }))

  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: role ? { id: 'user-1' } : null }, error: null }),
      },
      from(table: string) {
        if (table === 'store_memberships') {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
              }
            },
          }
        }

        if (table === 'store_notification_settings') {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                maybeSingle: async () => ({ data: options?.notificationRow ?? null, error: null }),
              }
            },
            upsert: notificationUpsertMock,
          }
        }

        if (table === 'store_reservation_payment_settings') {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                maybeSingle: async () => ({ data: options?.reservationRow ?? null, error: null }),
              }
            },
            upsert: reservationUpsertMock,
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    },
    notificationUpsertMock,
    reservationUpsertMock,
  }
}

function createAdminConnectionsClient(options?: {
  rows?: Array<{
    provider: 'stripe' | 'komoju'
    is_active: boolean
    secret_key: string | null
    webhook_secret: string | null
    komoju_api_base_url: string | null
  }>
  existingRow?: {
    secret_key: string | null
    webhook_secret: string | null
    komoju_api_base_url: string | null
    is_active: boolean
  } | null
}) {
  const upsertPayloads: unknown[] = []

  const from = vi.fn(() => ({
    select(columns: string) {
      if (columns.includes('provider, is_active, secret_key, webhook_secret, komoju_api_base_url')) {
        return {
          eq: async () => ({ data: options?.rows ?? [], error: null }),
        }
      }
      return {
        eq() {
          return this
        },
        maybeSingle: async () => ({ data: options?.existingRow ?? null, error: null }),
      }
    },
    upsert(payload: unknown) {
      upsertPayloads.push(payload)
      return {
        select() {
          return {
            single: async () => ({
              data: {
                provider: 'komoju',
                is_active: true,
                secret_key: 'sec_live',
                webhook_secret: 'whsec_live',
                komoju_api_base_url: 'https://komoju.test',
              },
              error: null,
            }),
          }
        },
      }
    },
  }))

  return { from, upsertPayloads }
}

function createThemeSupabase(options?: {
  user?: { id: string } | null
  themeRow?: { ui_theme?: string | null } | null
  updateRows?: Array<{ id: string }>
}) {
  const user = options?.user ?? { id: 'user-1' }
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from(table: string) {
      if (table !== 'staffs') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: options?.themeRow ?? null, error: null }),
            limit: async () => ({ data: options?.updateRows ?? [{ id: 'staff-1' }], error: null }),
          }
        },
        update() {
          return {
            eq() {
              return this
            },
            select() {
              return this
            },
            limit: async () => ({ data: options?.updateRows ?? [{ id: 'staff-1' }], error: null }),
          }
        },
      }
    },
  }
}

describe('settings routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    fetchStorePlanOptionStateMock.mockResolvedValue({ planCode: 'standard' })
    canPurchaseOptionsByPlanMock.mockReturnValue(true)
    requireOwnerStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'owner-1' },
    })
    upsertStoreStoragePolicyMock.mockResolvedValue(undefined)
    resolveCurrentStoreIdMock.mockResolvedValue('store-1')
  })

  // TRACE-191
  it('GET /api/settings/notification-settings returns 403 when plan cannot purchase options', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })
    canPurchaseOptionsByPlanMock.mockReturnValueOnce(false)

    const { GET } = await import('../src/app/api/settings/notification-settings/route')
    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: '通知設定はスタンダード以上で利用できます。',
    })
  })

  // TRACE-192
  it('POST /api/settings/notification-settings normalizes limits and followup_days', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })

    const { POST } = await import('../src/app/api/settings/notification-settings/route')
    const response = await POST(
      new Request('http://localhost/api/settings/notification-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          followup_days: '90,30,30,999',
          monthly_message_limit: 5000,
          monthly_message_limit_with_option: 100,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(scoped.notificationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        followup_days: [30, 90],
        monthly_message_limit: 5000,
        monthly_message_limit_with_option: 5000,
      }),
      { onConflict: 'store_id' }
    )
  })

  // TRACE-193
  it('POST /api/settings/payment-provider-connections rejects unsupported provider', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })

    const { POST } = await import('../src/app/api/settings/payment-provider-connections/route')
    const response = await POST(
      new Request('http://localhost/api/settings/payment-provider-connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'paypal' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'provider must be stripe or komoju.',
    })
  })

  // TRACE-194
  it('POST /api/settings/payment-provider-connections keeps existing secrets when blank values are sent', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })
    const admin = createAdminConnectionsClient({
      existingRow: {
        secret_key: 'sec_existing',
        webhook_secret: 'whsec_existing',
        komoju_api_base_url: 'https://api.komoju.com',
        is_active: true,
      },
    })
    createAdminSupabaseClientMock.mockReturnValue({ from: admin.from })

    const { POST } = await import('../src/app/api/settings/payment-provider-connections/route')
    const response = await POST(
      new Request('http://localhost/api/settings/payment-provider-connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'komoju',
          secret_key: '  ',
          webhook_secret: '',
          komoju_api_base_url: '  ',
          is_active: 'true',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(admin.upsertPayloads[0]).toEqual(
      expect.objectContaining({
        secret_key: 'sec_existing',
        webhook_secret: 'whsec_existing',
        komoju_api_base_url: 'https://api.komoju.com',
      })
    )
  })

  // TRACE-195
  it('POST /api/settings/reservation-payment-settings clamps percents and normalizes charge mode', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })

    const { POST } = await import('../src/app/api/settings/reservation-payment-settings/route')
    const response = await POST(
      new Request('http://localhost/api/settings/reservation-payment-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cancellation_day_before_percent: -10,
          cancellation_same_day_percent: 220,
          cancellation_no_show_percent: '55',
          no_show_charge_mode: 'manual',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(scoped.reservationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellation_day_before_percent: 0,
        cancellation_same_day_percent: 100,
        cancellation_no_show_percent: 55,
        no_show_charge_mode: 'manual',
      }),
      { onConflict: 'store_id' }
    )
  })

  it('POST /api/settings/reservation-payment-settings uses latest form value for checkbox fields', async () => {
    const scoped = createSettingsSupabase({ role: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase: scoped.supabase, storeId: 'store-1' })

    const { POST } = await import('../src/app/api/settings/reservation-payment-settings/route')
    const form = new FormData()
    form.append('prepayment_enabled', 'false')
    form.append('prepayment_enabled', 'true')
    form.append('card_hold_enabled', 'false')
    form.append('cancellation_day_before_percent', '10')
    form.append('cancellation_same_day_percent', '20')
    form.append('cancellation_no_show_percent', '30')
    form.append('no_show_charge_mode', 'auto')

    const response = await POST(
      new Request('http://localhost/api/settings/reservation-payment-settings', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    expect(scoped.reservationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prepayment_enabled: true,
        card_hold_enabled: false,
        cancellation_day_before_percent: 10,
        cancellation_same_day_percent: 20,
        cancellation_no_show_percent: 30,
        no_show_charge_mode: 'auto',
      }),
      { onConflict: 'store_id' }
    )
  })

  // TRACE-196
  it('POST /api/settings/storage-policy returns membership guard error', async () => {
    requireOwnerStoreMembershipMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'forbidden',
    })

    const { POST } = await import('../src/app/api/settings/storage-policy/route')
    const response = await POST(
      new Request('http://localhost/api/settings/storage-policy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy: 'block' }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: 'forbidden' })
  })

  // TRACE-197
  it('POST /api/settings/storage-policy returns form redirect with error on upsert failure', async () => {
    upsertStoreStoragePolicyMock.mockRejectedValueOnce(new Error('db failed'))
    const { POST } = await import('../src/app/api/settings/storage-policy/route')
    const form = new FormData()
    form.set('policy', 'cleanup_orphans')
    form.set('redirect_to', '/settings/storage')

    const response = await POST(
      new Request('http://localhost/api/settings/storage-policy', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    expect(decodeURIComponent(response.headers.get('location') ?? '')).toContain('/settings/storage?error=db+failed')
  })

  // TRACE-198
  it('POST /api/settings/theme returns 400 for invalid theme', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createThemeSupabase())
    resolveCurrentStoreIdMock.mockResolvedValue('store-1')

    const { POST } = await import('../src/app/api/settings/theme/route')
    const response = await POST(
      new Request('http://localhost/api/settings/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'invalid-theme' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid theme value.' })
  })

  // TRACE-199
  it('POST /api/settings/theme returns 404 when staff profile does not exist', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createThemeSupabase({
        updateRows: [],
      })
    )
    resolveCurrentStoreIdMock.mockResolvedValue('store-1')

    const { POST } = await import('../src/app/api/settings/theme/route')
    const response = await POST(
      new Request('http://localhost/api/settings/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'clean-medical' }),
      })
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Staff profile not found.' })
  })
})
