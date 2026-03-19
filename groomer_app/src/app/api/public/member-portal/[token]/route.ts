import { NextResponse } from 'next/server'
import { getMemberPortalPayload, MemberPortalServiceError } from '@/lib/member-portal'
import { pickClientIpFromHeaders, toPrivacyHash } from '@/lib/privacy-hash'

type RouteParams = {
  params: Promise<{
    token: string
  }>
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params
  const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
  const uaHash = toPrivacyHash(request.headers.get('user-agent'))

  try {
    const payload = await getMemberPortalPayload(token, {
      accessContext: {
        ipHash,
        uaHash,
      },
    })
    // Keep public response scope fixed even if internal payload grows in the future.
    return NextResponse.json({
      customer: {
        full_name: payload.customer.full_name,
      },
      store: {
        id: payload.store.id,
        name: payload.store.name,
      },
      memberCard: {
        label: payload.memberCard.label,
        expiresAt: payload.memberCard.expiresAt,
        rank: payload.memberCard.rank,
      },
      nextAppointment: payload.nextAppointment
        ? {
            start_time: payload.nextAppointment.start_time,
            status: payload.nextAppointment.status,
            menu: payload.nextAppointment.menu,
            staff_name: payload.nextAppointment.staff_name,
            pet_name: payload.nextAppointment.pet_name,
          }
        : null,
      nextVisitSuggestion: payload.nextVisitSuggestion
        ? {
            recommended_date: payload.nextVisitSuggestion.recommended_date,
            reason: payload.nextVisitSuggestion.reason,
          }
        : null,
      announcements: payload.announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        published_at: announcement.published_at,
      })),
      visitHistory: payload.visitHistory.map((visit) => ({
        id: visit.id,
        visit_date: visit.visit_date,
        menu: visit.menu,
        total_amount: visit.total_amount,
        staff_name: visit.staff_name,
      })),
    }, { headers: noStoreHeaders() })
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: noStoreHeaders() }
      )
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500, headers: noStoreHeaders() })
  }
}
