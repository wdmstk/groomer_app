import { NextResponse } from 'next/server'
import {
  getMemberPortalReservationPrefill,
  MemberPortalServiceError,
} from '@/lib/member-portal'
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
    const prefill = await getMemberPortalReservationPrefill(token, {
      accessContext: {
        ipHash,
        uaHash,
      },
    })

    return NextResponse.json({
      store: prefill.store,
      customer: prefill.customer,
      pet: prefill.pet,
      recommendedMenuIds: prefill.recommendedMenuIds,
      pets: prefill.pets,
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
