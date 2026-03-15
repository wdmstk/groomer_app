import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { sendLineMessage } from '@/lib/line'
import {
  buildMedicalRecordShareLineMessage,
  buildMedicalRecordShareUrl,
  createMedicalRecordShareLink,
} from '@/lib/medical-records/share'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createStoreScopedClient } from '@/lib/supabase/store'

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
    .select('id, appointment_id, status, pets(name)')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!record) {
    return NextResponse.json({ message: '対象カルテが見つかりません。' }, { status: 404 })
  }

  if (record.status !== 'finalized') {
    return NextResponse.json({ message: '確定済みカルテのみLINE送信できます。' }, { status: 400 })
  }

  const appointmentId =
    typeof record.appointment_id === 'string' && record.appointment_id.length > 0
      ? record.appointment_id
      : null
  if (!appointmentId) {
    return NextResponse.json({ message: '予約情報が紐づいていないためLINE送信できません。' }, { status: 400 })
  }

  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, customer_id')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!appointment?.customer_id) {
    return NextResponse.json({ message: '顧客情報が紐づいていないためLINE送信できません。' }, { status: 400 })
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, line_id')
    .eq('id', appointment.customer_id)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!customer) {
    return NextResponse.json({ message: '顧客が見つかりません。' }, { status: 404 })
  }
  if (!customer.line_id) {
    return NextResponse.json({ message: 'LINE送信先が未登録です。' }, { status: 400 })
  }

  try {
    const { shareLink, shareToken, expiresAt } = await createMedicalRecordShareLink({
      supabase: adminSupabase,
      storeId,
      recordId: record_id,
      createdByUserId: user?.id ?? null,
    })
    const shareUrl = buildMedicalRecordShareUrl(request.url, shareToken)
    const petRelation = Array.isArray(record.pets) ? record.pets[0] : record.pets
    const body = buildMedicalRecordShareLineMessage({
      customerName: customer.full_name,
      petName: petRelation?.name ?? null,
      shareUrl,
    })

    const { data: queuedLog, error: logError } = await supabase
      .from('customer_notification_logs')
      .insert({
        store_id: storeId,
        customer_id: customer.id,
        appointment_id: appointmentId,
        actor_user_id: user?.id ?? null,
        channel: 'line',
        notification_type: 'other',
        status: 'queued',
        subject: '写真カルテ共有',
        body,
        target: customer.line_id,
        payload: {
          kind: 'medical_record_share',
          medical_record_id: record_id,
          share_link_id: shareLink.id,
          share_url: shareUrl,
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (logError || !queuedLog?.id) {
      throw new Error(logError?.message ?? '通知ログの作成に失敗しました。')
    }

    const sendResult = await sendLineMessage({
      to: customer.line_id,
      messages: [{ type: 'text', text: body }],
    })
    if (!sendResult.success) {
      await supabase
        .from('customer_notification_logs')
        .update({
          status: 'failed',
          sent_at: new Date().toISOString(),
          payload: {
            kind: 'medical_record_share',
            medical_record_id: record_id,
            share_link_id: shareLink.id,
            share_url: shareUrl,
            reason: sendResult.error ?? 'line_send_failed',
          },
        })
        .eq('id', queuedLog.id)
      return NextResponse.json({ message: sendResult.error ?? 'LINE送信に失敗しました。' }, { status: 500 })
    }

    await supabase
      .from('customer_notification_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', queuedLog.id)

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
        shared_via_line: true,
      },
      payload: {
        share_link_id: shareLink.id,
        customer_id: customer.id,
        notification_log_id: queuedLog.id,
        expires_at: expiresAt,
      },
    })

    return NextResponse.json({ ok: true, shareUrl, expiresAt, notificationLogId: queuedLog.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LINE送信に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
