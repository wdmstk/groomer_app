import { NextResponse } from 'next/server'
import { getMemberPortalPayload, MemberPortalServiceError } from '@/lib/member-portal'

type RouteParams = {
  params: Promise<{
    token: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const payload = await getMemberPortalPayload(token)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
