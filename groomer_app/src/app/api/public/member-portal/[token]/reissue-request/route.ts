import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  hashMemberPortalToken,
  isValidMemberPortalTokenFormat,
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

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params
  if (!isValidMemberPortalTokenFormat(token)) {
    return NextResponse.json({ message: '会員証URLが不正です。' }, { status: 400, headers: noStoreHeaders() })
  }

  const admin = createAdminSupabaseClient()
  const tokenHash = hashMemberPortalToken(token)
  const nowIso = new Date().toISOString()
  const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
  const uaHash = toPrivacyHash(request.headers.get('user-agent'))
  const body = (await request.json().catch(() => ({}))) as { note?: string }
  const requestNote =
    typeof body.note === 'string' && body.note.trim().length > 0
      ? body.note.trim().slice(0, 200)
      : null

  const { data: link, error: linkError } = await admin
    .from('member_portal_links')
    .select('id, store_id, customer_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .eq('purpose', 'member_portal')
    .maybeSingle()

  if (linkError) {
    return NextResponse.json({ message: linkError.message }, { status: 500, headers: noStoreHeaders() })
  }
  if (!link) {
    return NextResponse.json({ message: '会員証URLが見つかりません。' }, { status: 404, headers: noStoreHeaders() })
  }
  if (!link.revoked_at && link.expires_at > nowIso) {
    return NextResponse.json(
      { message: 'この会員証URLはまだ有効です。再発行リクエストは不要です。' },
      { status: 400, headers: noStoreHeaders() }
    )
  }

  const { data: pending, error: pendingError } = await admin
    .from('member_portal_reissue_requests' as never)
    .select('id, requested_at' as never)
    .eq('store_id', link.store_id)
    .eq('customer_id', link.customer_id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    return NextResponse.json({ message: pendingError.message }, { status: 500, headers: noStoreHeaders() })
  }
  const pendingRequest = pending as { id: string; requested_at: string | null } | null

  if (!pending) {
    const { error: insertError } = await admin
      .from('member_portal_reissue_requests' as never)
      .insert({
        store_id: link.store_id,
        customer_id: link.customer_id,
        member_portal_link_id: link.id,
        status: 'pending',
        requested_at: nowIso,
        requested_ip_hash: ipHash,
        requested_ua_hash: uaHash,
        request_note: requestNote,
        updated_at: nowIso,
      } as never)

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500, headers: noStoreHeaders() })
    }
  }

  await admin.from('audit_logs').insert({
    store_id: link.store_id,
    actor_user_id: null,
    entity_type: 'member_portal_link',
    entity_id: link.id,
    action: 'reissue_requested',
    payload: {
      customer_id: link.customer_id,
      token_id: link.id,
      requested_ip_hash: ipHash,
      requested_ua_hash: uaHash,
      request_note: requestNote,
      pending_exists: Boolean(pendingRequest),
    },
  })

  return NextResponse.json(
    {
      message: pendingRequest
        ? 'すでに再発行リクエストを受け付けています。店舗からの案内をお待ちください。'
        : '再発行リクエストを受け付けました。店舗からの案内をお待ちください。',
      requestedAt: pendingRequest?.requested_at ?? nowIso,
    },
    { headers: noStoreHeaders() }
  )
}
