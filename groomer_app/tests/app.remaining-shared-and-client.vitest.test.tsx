import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  notFoundMock,
  getSharedJournalPayloadMock,
  getMemberPortalPayloadMock,
  createAdminSupabaseClientMock,
  createSignedPhotoUrlMapMock,
  getCancelReservationTokenErrorMock,
} = vi.hoisted(() => ({
  notFoundMock: vi.fn(),
  getSharedJournalPayloadMock: vi.fn(),
  getMemberPortalPayloadMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  createSignedPhotoUrlMapMock: vi.fn(),
  getCancelReservationTokenErrorMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt = '', ...props }: { alt?: string; [k: string]: unknown }) => <img alt={alt} {...props} />,
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>,
}))

vi.mock('@/components/member-portal/MemberPortalWaitlistCard', () => ({
  MemberPortalWaitlistCard: () => <div data-testid="waitlist-card">waitlist-card</div>,
}))

vi.mock('@/components/member-portal/MemberPortalReissueRequestButton', () => ({
  MemberPortalReissueRequestButton: ({ token }: { token: string }) => <button type="button">reissue:{token}</button>,
}))

vi.mock('@/lib/journal/shared', () => ({
  getSharedJournalPayload: getSharedJournalPayloadMock,
}))

vi.mock('@/lib/member-portal', () => ({
  getMemberPortalPayload: getMemberPortalPayloadMock,
  MemberPortalServiceError: class MemberPortalServiceError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/medical-records/share', () => ({
  hashMedicalRecordShareToken: () => 'hashed-token',
}))

vi.mock('@/lib/medical-records/photos', () => ({
  createSignedPhotoUrlMap: createSignedPhotoUrlMapMock,
}))

vi.mock('@/lib/public-reservations/presentation', () => ({
  getCancelReservationTokenError: getCancelReservationTokenErrorMock,
}))

describe('remaining shared and client pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NOT_FOUND')
    })
  })

  it('renders invite accept client success message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: '招待を受け付けました。' }),
      }),
    )
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
    const { InviteAcceptClient } = await import('../src/app/invite/[token]/page-client')

    render(<InviteAcceptClient token="invite-1" />)

    await waitFor(() => {
      expect(screen.getByText('招待を受け付けました。')).toBeTruthy()
    })
  })

  it('renders cancel reservation client token error', async () => {
    getCancelReservationTokenErrorMock.mockReturnValue('トークンが不正です。')
    const { CancelReservationClient } = await import('../src/app/reserve/cancel/page-client')

    render(<CancelReservationClient token="bad-token" />)
    fireEvent.click(screen.getByRole('button', { name: '予約をキャンセルする' }))

    expect(screen.getByText('トークンが不正です。')).toBeTruthy()
  })

  it('renders shared journal unavailable message when payload is missing', async () => {
    const { MemberPortalServiceError } = await import('@/lib/member-portal')
    getSharedJournalPayloadMock.mockRejectedValue(new MemberPortalServiceError(410, '有効期限切れです。'))
    const { default: SharedJournalPage } = await import('../src/app/shared/journal/[token]/page')

    render(await SharedJournalPage({ params: Promise.resolve({ token: 'token-1' }) }))

    expect(screen.getByRole('heading', { level: 1, name: '日誌アルバム' })).toBeTruthy()
    expect(screen.getByText('有効期限切れです。')).toBeTruthy()
  })

  it('renders shared journal entries when payload exists', async () => {
    getSharedJournalPayloadMock.mockResolvedValue({
      customerName: '山田 花子',
      expiresAt: '2026-04-30T00:00:00.000Z',
      entries: [
        {
          id: 'entry-1',
          posted_at: '2026-04-01T00:00:00.000Z',
          created_at: '2026-04-01T00:00:00.000Z',
          body_text: 'お利口でした',
          petNames: ['モカ'],
          media: [{ id: 'm1', media_type: 'photo', signed_url: 'https://example.com/a.jpg' }],
        },
      ],
    })
    const { default: SharedJournalPage } = await import('../src/app/shared/journal/[token]/page')

    render(await SharedJournalPage({ params: Promise.resolve({ token: 'token-1' }) }))

    expect(screen.getByText('山田 花子様の日誌')).toBeTruthy()
    expect(screen.getByText('お利口でした')).toBeTruthy()
  })

  it('renders shared member portal unavailable message', async () => {
    const { MemberPortalServiceError } = await import('@/lib/member-portal')
    getMemberPortalPayloadMock.mockRejectedValue(new MemberPortalServiceError(410, '有効期限切れ'))
    const { default: SharedMemberPortalPage } = await import('../src/app/shared/member-portal/[token]/page')

    render(await SharedMemberPortalPage({ params: Promise.resolve({ token: 'token-1' }) }))

    expect(screen.getByRole('heading', { level: 1, name: '会員証ページ' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'reissue:token-1' })).toBeTruthy()
  })

  it('renders shared member portal details when payload exists', async () => {
    getMemberPortalPayloadMock.mockResolvedValue({
      memberCard: { label: '会員証', expiresAt: '2026-04-30T00:00:00.000Z', rank: 'ゴールド' },
      customer: { full_name: '山田 花子' },
      store: { id: 'store-1', name: '店舗A' },
      nextAppointment: {
        status: '予約済',
        start_time: '2026-04-20T00:00:00.000Z',
        menu: 'シャンプー',
        staff_name: '担当A',
        pet_name: 'モカ',
      },
      nextVisitSuggestion: null,
      visitHistory: [],
      announcements: [],
      journalEntries: [],
      medicalRecords: [],
      notices: [],
    })
    const { default: SharedMemberPortalPage } = await import('../src/app/shared/member-portal/[token]/page')

    render(await SharedMemberPortalPage({ params: Promise.resolve({ token: 'token-1' }) }))

    expect(screen.getByText('会員証')).toBeTruthy()
    expect(screen.getByText('山田 花子様')).toBeTruthy()
    expect(screen.getByText('次回予約')).toBeTruthy()
  })

  it('calls notFound when shared medical record link is missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null })
    const eq = vi.fn(() => ({ is: vi.fn(() => ({ gt: vi.fn(() => ({ maybeSingle })) })) }))
    createAdminSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })),
    })
    const { default: SharedMedicalRecordPage } = await import('../src/app/shared/medical-records/[token]/page')

    await expect(
      SharedMedicalRecordPage({ params: Promise.resolve({ token: 'token-1' }) }),
    ).rejects.toThrow('NOT_FOUND')

    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('renders shared medical record photos when link exists', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'share-1', medical_record_id: 'record-1', expires_at: '2026-04-30T00:00:00.000Z', revoked_at: null } })
      .mockResolvedValueOnce({
        data: [
          { id: 'p1', photo_type: 'before', storage_path: 'before.jpg', comment: null, sort_order: 1, taken_at: '2026-04-01T00:00:00.000Z' },
          { id: 'p2', photo_type: 'after', storage_path: 'after.jpg', comment: null, sort_order: 1, taken_at: '2026-04-01T01:00:00.000Z' },
        ],
      })

    const fromMock = vi.fn((table: string) => {
      if (table === 'medical_record_share_links') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                gt: () => ({ maybeSingle: () => maybeSingle() }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ order: () => ({ order: () => maybeSingle() }) }),
          }),
        }),
      }
    })

    createAdminSupabaseClientMock.mockReturnValue({ from: fromMock })
    createSignedPhotoUrlMapMock.mockResolvedValue(new Map([['before.jpg', 'https://example.com/before.jpg'], ['after.jpg', 'https://example.com/after.jpg']]))

    const { default: SharedMedicalRecordPage } = await import('../src/app/shared/medical-records/[token]/page')

    render(await SharedMedicalRecordPage({ params: Promise.resolve({ token: 'token-1' }) }))

    expect(screen.getByRole('heading', { level: 1, name: '写真カルテ' })).toBeTruthy()
    expect(screen.getByText('施術前')).toBeTruthy()
    expect(screen.getByText('施術後')).toBeTruthy()
  })
})
