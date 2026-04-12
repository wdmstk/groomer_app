import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => {
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string
      children: ReactNode
      [key: string]: unknown
    }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('../src/app/invite/[token]/page-client', () => {
  return {
    InviteAcceptClient: ({ token }: { token: string }) => <div data-testid="invite-client">invite:{token}</div>,
  }
})

vi.mock('../src/app/reserve/cancel/page-client', () => {
  return {
    CancelReservationClient: ({ token }: { token: string }) => (
      <div data-testid="reserve-cancel-client">cancel:{token}</div>
    ),
  }
})

vi.mock('../src/app/reserve/[store_id]/reserve-form', () => {
  return {
    ReserveForm: ({
      storeId,
      memberPortalToken,
      reservationMode,
    }: {
      storeId: string
      memberPortalToken: string
      reservationMode: string
    }) => (
      <div data-testid="reserve-form">
        store:{storeId}|token:{memberPortalToken}|mode:{reservationMode}
      </div>
    ),
  }
})

vi.mock('@/components/consents/ConsentSignClient', () => {
  return {
    ConsentSignClient: ({
      token,
      serviceName,
      appointmentId,
      snsUsagePreference,
    }: {
      token: string
      serviceName: string
      appointmentId: string
      snsUsagePreference: string
    }) => (
      <div data-testid="consent-sign-client">
        token:{token}|service:{serviceName}|appt:{appointmentId}|sns:{snsUsagePreference}
      </div>
    ),
  }
})

import BillingSuccessPage from '../src/app/billing/success/page'
import ConsentSignPage from '../src/app/consent/sign/[token]/page'
import InviteTokenPage from '../src/app/invite/[token]/page'
import ReservePage from '../src/app/reserve/[store_id]/page'
import CancelReservationPage from '../src/app/reserve/cancel/page'

describe('route props pages', () => {
  // TRACE-332
  it('passes token to invite accept client', async () => {
    render(await InviteTokenPage({ params: Promise.resolve({ token: 'invite-123' }) }))

    expect(screen.getByTestId('invite-client').textContent).toContain('invite:invite-123')
  })

  it('passes token from search params to cancel reservation client', async () => {
    render(await CancelReservationPage({ searchParams: Promise.resolve({ token: 'cancel-abc' }) }))

    expect(screen.getByTestId('reserve-cancel-client').textContent).toContain('cancel:cancel-abc')
  })

  it('maps reserve page query aliases into memberPortalToken and reservationMode', async () => {
    render(
      await ReservePage({
        params: Promise.resolve({ store_id: 'store-1' }),
        searchParams: Promise.resolve({ memberPortalToken: 'member-xyz', mode: 'repeat' }),
      }),
    )

    expect(screen.getByTestId('reserve-form').textContent).toContain('store:store-1')
    expect(screen.getByTestId('reserve-form').textContent).toContain('token:member-xyz')
    expect(screen.getByTestId('reserve-form').textContent).toContain('mode:repeat')
  })

  it('passes token and optional query params to consent sign client', async () => {
    render(
      await ConsentSignPage({
        params: Promise.resolve({ token: 'consent-1' }),
        searchParams: Promise.resolve({
          service_name: 'シャンプー',
          appointment_id: 'appt-1',
          sns_usage_preference: 'yes',
        }),
      }),
    )

    expect(screen.getByTestId('consent-sign-client').textContent).toContain('token:consent-1')
    expect(screen.getByTestId('consent-sign-client').textContent).toContain('service:シャンプー')
    expect(screen.getByTestId('consent-sign-client').textContent).toContain('appt:appt-1')
    expect(screen.getByTestId('consent-sign-client').textContent).toContain('sns:yes')
  })

  it('shows setup-assistance success message on billing success page', async () => {
    render(await BillingSuccessPage({ searchParams: Promise.resolve({ mode: 'setup-assistance' }) }))

    expect(screen.getByText('初期設定代行の申込を受け付けました。運営側で確認後、設定作業を開始します。')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ダッシュボードへ' }).getAttribute('href')).toBe('/dashboard')
  })

  it('shows storage-addon success message on billing success page', async () => {
    render(await BillingSuccessPage({ searchParams: Promise.resolve({ mode: 'storage-addon' }) }))

    expect(screen.getByText('容量追加の決済を受け付けました。反映まで数秒〜数分かかる場合があります。')).toBeTruthy()
  })
})
