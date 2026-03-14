import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import {
  generateMedicalRecordShareToken,
  getMedicalRecordShareExpiresAt,
  hashMedicalRecordShareToken,
} from '@/lib/medical-records/share'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const adminSupabase = createAdminSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: record } = await supabase
    .from('medical_records')
    .select('id, status')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!record) {
    return NextResponse.json({ message: '対象カルテが見つかりません。' }, { status: 404 })
  }

  if (record.status !== 'finalized') {
    return NextResponse.json({ message: '確定済みカルテのみ共有できます。' }, { status: 400 })
  }

  const shareToken = generateMedicalRecordShareToken()
  const expiresAt = getMedicalRecordShareExpiresAt()
  const shareLinkInsert: Database['public']['Tables']['medical_record_share_links']['Insert'] = {
    store_id: storeId,
    medical_record_id: record_id,
    token_hash: hashMedicalRecordShareToken(shareToken),
    expires_at: expiresAt,
    created_by_user_id: user?.id ?? null,
  }

  const { data: shareLink, error } = await adminSupabase
    .from('medical_record_share_links')
    .insert(shareLinkInsert)
    .select('id, medical_record_id, expires_at, created_by_user_id')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'medical_record',
    entityId: record_id,
    action: 'shared',
    before: record,
    after: {
      ...record,
      shared: true,
    },
    payload: {
      share_link_id: shareLink.id,
      expires_at: shareLink.expires_at,
      created_by_user_id: shareLink.created_by_user_id,
    },
  })

  const shareUrl = new URL(`/shared/medical-records/${shareToken}`, request.url).toString()
  return NextResponse.json({ shareUrl, expiresAt })
}
