import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  buildMedicalRecordShareUrl,
  createMedicalRecordShareLink,
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

  try {
    const { shareLink, shareToken, expiresAt } = await createMedicalRecordShareLink({
      supabase: adminSupabase,
      storeId,
      recordId: record_id,
      createdByUserId: user?.id ?? null,
    })

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

    const shareUrl = buildMedicalRecordShareUrl(request.url, shareToken)
    return NextResponse.json({ shareUrl, expiresAt })
  } catch (error) {
    const message = error instanceof Error ? error.message : '共有URLの発行に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
