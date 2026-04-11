import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  fetchAppointmentMenusMock,
  calculatePaymentTotalsMock,
  resolveActiveStoreProviderCredentialsMock,
  findBillingCustomerMock,
  upsertBillingCustomerMock,
  createProviderCustomerMock,
  createStripeOneTimeCheckoutSessionMock,
  createKomojuOneTimeCheckoutSessionMock,
  insertAuditLogBestEffortMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  fetchAppointmentMenusMock: vi.fn(),
  calculatePaymentTotalsMock: vi.fn(),
  resolveActiveStoreProviderCredentialsMock: vi.fn(),
  findBillingCustomerMock: vi.fn(),
  upsertBillingCustomerMock: vi.fn(),
  createProviderCustomerMock: vi.fn(),
  createStripeOneTimeCheckoutSessionMock: vi.fn(),
  createKomojuOneTimeCheckoutSessionMock: vi.fn(),
  insertAuditLogBestEffortMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/payments/services/shared', () => ({
  fetchAppointmentMenus: fetchAppointmentMenusMock,
  calculatePaymentTotals: calculatePaymentTotalsMock,
}))

vi.mock('@/lib/billing/provider-connections', () => ({
  resolveActiveStoreProviderCredentials: resolveActiveStoreProviderCredentialsMock,
}))

vi.mock('@/lib/billing/db', () => ({
  findBillingCustomer: findBillingCustomerMock,
  upsertBillingCustomer: upsertBillingCustomerMock,
}))

vi.mock('@/lib/billing/providers', () => ({
  createProviderCustomer: createProviderCustomerMock,
  createStripeOneTimeCheckoutSession: createStripeOneTimeCheckoutSessionMock,
  createKomojuOneTimeCheckoutSession: createKomojuOneTimeCheckoutSessionMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createCheckoutSupabase(options: {
  user?: { id: string; email?: string | null } | null
  membership?: unknown
  appointment?: unknown
  settingsRow?: unknown
  subscriptionRow?: unknown
  appointmentError?: { message: string } | null
  membershipError?: { message: string } | null
}) {
  const {
    user = { id: 'user-1', email: 'owner@example.com' },
    membership = { id: 'membership-1' },
    appointment = {
      id: 'appt-1',
      reservation_payment_method: 'prepayment',
      reservation_payment_status: 'unpaid',
    },
    settingsRow = { prepayment_enabled: true },
    subscriptionRow = { preferred_provider: 'stripe' },
    appointmentError = null,
    membershipError = null,
  } = options

  return {
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'unauthorized' } }),
    },
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: membership, error: membershipError }),
            }
          },
        }
      }
      if (table === 'appointments') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: appointment, error: appointmentError }),
            }
          },
        }
      }
      if (table === 'store_reservation_payment_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: settingsRow, error: null }),
            }
          },
        }
      }
      if (table === 'store_subscriptions') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: subscriptionRow, error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table for checkout: ${table}`)
    },
  }
}

function createClaimSupabase(options: {
  user?: { id: string } | null
  appointment?: unknown
  appointmentError?: { message: string } | null
  settingsRow?: unknown
  updateError?: { message: string } | null
}) {
  const {
    user = { id: 'user-1' },
    appointment = {
      id: 'appt-1',
      status: '無断キャンセル',
      reservation_payment_method: 'prepayment',
      reservation_payment_status: 'unpaid',
      reservation_payment_paid_at: null,
      reservation_payment_authorized_at: null,
    },
    appointmentError = null,
    settingsRow = { cancellation_no_show_percent: 100, no_show_charge_mode: 'full' },
    updateError = null,
  } = options

  const updateEq2 = vi.fn().mockResolvedValue({ error: updateError })
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }))

  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from(table: string) {
      if (table === 'appointments') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: appointment, error: appointmentError }),
            }
          },
          update() {
            return {
              eq: updateEq1,
            }
          },
        }
      }
      if (table === 'store_reservation_payment_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: settingsRow, error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table for claim: ${table}`)
    },
  }
}

describe('appointments reservation-payment routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    createStoreScopedClientMock.mockResolvedValue({
      supabase: createCheckoutSupabase({}),
      storeId: 'store-1',
    })
    fetchAppointmentMenusMock.mockResolvedValue([{ id: 'menu-1' }])
    calculatePaymentTotalsMock.mockReturnValue({ total: 5000 })
    resolveActiveStoreProviderCredentialsMock.mockResolvedValue({
      secretKey: 'sk_test',
      komojuApiBaseUrl: 'https://komoju.test',
    })
    findBillingCustomerMock.mockResolvedValue(null)
    createProviderCustomerMock.mockResolvedValue('cus_123')
    upsertBillingCustomerMock.mockResolvedValue(undefined)
    createStripeOneTimeCheckoutSessionMock.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/pay' })
    createKomojuOneTimeCheckoutSessionMock.mockResolvedValue({ id: 'ko_1', url: 'https://komoju.test/pay' })
    insertAuditLogBestEffortMock.mockResolvedValue(undefined)
  })

  // TRACE-175
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 401 when user is unauthorized', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createCheckoutSupabase({ user: null }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  // TRACE-176
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 404 when appointment is missing', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createCheckoutSupabase({ appointment: null }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '対象予約が見つかりません。' })
  })

  // TRACE-177
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 400 when prepayment setting is disabled', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createCheckoutSupabase({ settingsRow: { prepayment_enabled: false } }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '事前決済設定が無効です。' })
  })

  // TRACE-178
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 400 when appointment is not prepayment target', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createCheckoutSupabase({
        appointment: {
          id: 'appt-1',
          reservation_payment_method: 'none',
          reservation_payment_status: 'unpaid',
        },
      }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'この予約は事前決済対象ではありません。' })
  })

  // TRACE-179
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 400 when amount is zero', async () => {
    calculatePaymentTotalsMock.mockReturnValueOnce({ total: 0 })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '決済対象金額が0円のため開始できません。' })
  })

  // TRACE-180
  it('POST /api/appointments/[appointment_id]/reservation-payment/checkout returns 400 when provider credentials are missing', async () => {
    resolveActiveStoreProviderCredentialsMock.mockResolvedValueOnce(null)
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe' }),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Stripe の店舗接続設定が未完了です。' })
  })

  // TRACE-181
  it('POST /api/appointments/[appointment_id]/reservation-payment/claim rejects non no-show appointment', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createClaimSupabase({ appointment: { id: 'appt-1', status: '予約済み' } }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/claim/route')

    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/claim', {
        method: 'POST',
        body: new FormData(),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '無断キャンセルの予約のみ請求できます。' })
  })

  // TRACE-182
  it('POST /api/appointments/[appointment_id]/reservation-payment/claim redirects after updating charge_pending', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createClaimSupabase({
        appointment: {
          id: 'appt-1',
          status: '無断キャンセル',
          reservation_payment_method: 'prepayment',
          reservation_payment_status: 'unpaid',
          reservation_payment_paid_at: null,
          reservation_payment_authorized_at: null,
        },
      }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/reservation-payment/claim/route')

    const form = new FormData()
    form.set('redirect_to', '/appointments?tab=list')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/reservation-payment/claim', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/appointments?tab=list')
    expect(insertAuditLogBestEffortMock).toHaveBeenCalledOnce()
  })
})
