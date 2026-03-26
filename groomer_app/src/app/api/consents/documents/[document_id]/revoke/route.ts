import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import { parseString } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ document_id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { document_id: documentId } = await params
  const body = asObjectOrNull(await request.json().catch(() => ({})))
  const reason = parseString(body?.reason) ?? 'manual revoke'

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: current, error: currentError } = await supabase
    .from('consent_documents' as never)
    .select('id, status, revoked_at')
    .eq('store_id', storeId)
    .eq('id', documentId)
    .maybeSingle()
  if (currentError) return NextResponse.json({ message: currentError.message }, { status: 500 })
  if (!current) return NextResponse.json({ message: 'document not found.' }, { status: 404 })
  if (current.status === 'revoked') return NextResponse.json({ ok: true, reused: true })

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('consent_documents' as never)
    .update({
      status: 'revoked',
      revoked_at: nowIso,
      revoked_reason: reason,
      sign_token_hash: null,
      token_expires_at: null,
      updated_at: nowIso,
      updated_by_user_id: user?.id ?? null,
    } as never)
    .eq('store_id', storeId)
    .eq('id', documentId)
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  await insertConsentAuditLogBestEffort({
    supabase,
    storeId,
    entityType: 'document',
    entityId: documentId,
    action: 'revoked',
    actorUserId: user?.id ?? null,
    before: current,
    after: {
      ...current,
      status: 'revoked',
      revoked_at: nowIso,
      revoked_reason: reason,
    },
    payload: { reason },
  })

  return NextResponse.json({ ok: true, document_id: documentId, status: 'revoked' })
}
