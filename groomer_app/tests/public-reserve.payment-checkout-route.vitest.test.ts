import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyReservationPaymentTokenMock,
  createAdminSupabaseClientMock,
  fetchAppointmentMenusMock,
  calculatePaymentTotalsMock,
  resolveActiveStoreProviderCredentialsMock,
  findBillingCustomerMock,
  upsertBillingCustomerMock,
  createProviderCustomerMock,
  createStripeOneTimeCheckoutSessionMock,
  createKomojuOneTimeCheckoutSessionMock,
} = vi.hoisted(() => ({
  verifyReservationPaymentTokenMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  fetchAppointmentMenusMock: vi.fn(),
  calculatePaymentTotalsMock: vi.fn(),
  resolveActiveStoreProviderCredentialsMock: vi.fn(),
  findBillingCustomerMock: vi.fn(),
  upsertBillingCustomerMock: vi.fn(),
  createProviderCustomerMock: vi.fn(),
  createStripeOneTimeCheckoutSessionMock: vi.fn(),
  createKomojuOneTimeCheckoutSessionMock: vi.fn(),
}))

vi.mock('@/lib/reservation-cancel-token', () => ({
  verifyReservationPaymentToken: verifyReservationPaymentTokenMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
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

function createAdminSupabase(options?: {
  appointment?: unknown
  settingsRow?: unknown
  subscriptionRow?: unknown
  customer?: unknown
}) {
  const appointment = options?.appointment ?? {
    id: 'appt-1',
    customer_id: 'customer-1',
    reservation_payment_method: 'prepayment',
    reservation_payment_status: 'unpaid',
  }
  const settingsRow = options?.settingsRow ?? {
    prepayment_enabled: true,
    card_hold_enabled: true,
  }
  const subscriptionRow = options?.subscriptionRow ?? {
    preferred_provider: 'stripe',
  }
  const customer = options?.customer ?? {
    id: 'customer-1',
    email: 'customer@example.com',
  }

  return {
    from(table: string) {
      if (table === 'appointments') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: appointment, error: null }),
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
      if (table === 'customers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: customer, error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('public reserve payment checkout route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    verifyReservationPaymentTokenMock.mockReturnValue({
      valid: true,
      payload: { appointmentId: 'appt-1', storeId: 'store-1' },
    })
    createAdminSupabaseClientMock.mockReturnValue(createAdminSupabase())
    fetchAppointmentMenusMock.mockResolvedValue([{ id: 'menu-1' }])
    calculatePaymentTotalsMock.mockReturnValue({ total: 5000 })
    resolveActiveStoreProviderCredentialsMock.mockResolvedValue({
      secretKey: 'sk_test',
      komojuApiBaseUrl: 'https://komoju.test',
    })
    findBillingCustomerMock.mockResolvedValue(null)
    createProviderCustomerMock.mockResolvedValue('cus_public_1')
    upsertBillingCustomerMock.mockResolvedValue(undefined)
    createStripeOneTimeCheckoutSessionMock.mockResolvedValue({
      id: 'cs_public_1',
      url: 'https://stripe.test/public',
    })
    createKomojuOneTimeCheckoutSessionMock.mockResolvedValue({
      id: 'ko_public_1',
      url: 'https://komoju.test/public',
    })
  })

  it('POST /api/public/reserve/payment/checkout returns 400 when token is missing', async () => {
    const { POST } = await import('../src/app/api/public/reserve/payment/checkout/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '決済トークンが必要です。' })
  })

  it('POST /api/public/reserve/payment/checkout returns 400 when token is invalid', async () => {
    verifyReservationPaymentTokenMock.mockReturnValueOnce({
      valid: false,
      reason: 'invalid_signature',
    })

    const { POST } = await import('../src/app/api/public/reserve/payment/checkout/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'bad-token' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '決済トークンが不正です。' })
  })

  it('POST /api/public/reserve/payment/checkout returns checkout_url for prepayment reservation', async () => {
    const { POST } = await import('../src/app/api/public/reserve/payment/checkout/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkout_url: 'https://stripe.test/public',
      session_id: 'cs_public_1',
      provider: 'stripe',
      amount_jpy: 5000,
    })
  })

  it('POST /api/public/reserve/payment/checkout returns 400 when card_hold status is already authorized', async () => {
    createAdminSupabaseClientMock.mockReturnValueOnce(
      createAdminSupabase({
        appointment: {
          id: 'appt-1',
          customer_id: 'customer-1',
          reservation_payment_method: 'card_hold',
          reservation_payment_status: 'authorized',
        },
      })
    )

    const { POST } = await import('../src/app/api/public/reserve/payment/checkout/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'この予約はすでに決済情報を取得済みです。',
    })
  })
})
