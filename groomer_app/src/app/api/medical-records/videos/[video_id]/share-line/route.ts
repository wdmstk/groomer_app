import { NextResponse } from 'next/server'
import { sendLineMessage } from '@/lib/line'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'

type RouteParams = {
  params: Promise<{
    video_id: string
  }>
}

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()
const MIN_LINE_SHORT_DURATION_SEC = 10
const MAX_LINE_SHORT_DURATION_SEC = 20

export async function POST(_request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: rawVideoRow, error: videoError } = await supabase
    .from('medical_record_videos' as never)
    .select(
      'id, medical_record_id, storage_path, thumbnail_path, line_short_path, duration_sec, medical_records(id, appointment_id, status)'
    )
    .eq('id', video_id)
    .eq('store_id', storeId)
    .maybeSingle()
  if (videoError) {
    return NextResponse.json({ message: videoError.message }, { status: 500 })
  }
  const videoRow = rawVideoRow as {
    id: string
    medical_record_id: string
    storage_path: string
    thumbnail_path: string | null
    line_short_path: string | null
    duration_sec: number | null
    medical_records:
      | {
          id: string
          appointment_id: string | null
          status: string | null
        }
      | Array<{
          id: string
          appointment_id: string | null
          status: string | null
        }>
      | null
  } | null
  if (!videoRow) {
    return NextResponse.json({ message: '対象動画が見つかりません。' }, { status: 404 })
  }

  const durationSec =
    typeof videoRow.duration_sec === 'number' && Number.isFinite(videoRow.duration_sec)
      ? Math.max(0, Math.floor(videoRow.duration_sec))
      : null
  if (
    durationSec === null ||
    durationSec < MIN_LINE_SHORT_DURATION_SEC ||
    durationSec > MAX_LINE_SHORT_DURATION_SEC
  ) {
    return NextResponse.json(
      {
        message: `LINE送信用は${MIN_LINE_SHORT_DURATION_SEC}〜${MAX_LINE_SHORT_DURATION_SEC}秒の動画のみ対応です。`,
      },
      { status: 400 }
    )
  }

  const recordRelation = Array.isArray(videoRow.medical_records)
    ? videoRow.medical_records[0]
    : videoRow.medical_records
  if (!recordRelation?.id) {
    return NextResponse.json({ message: 'カルテ情報が見つかりません。' }, { status: 404 })
  }
  if (recordRelation.status !== 'finalized') {
    return NextResponse.json({ message: '確定済みカルテのみLINE送信できます。' }, { status: 400 })
  }
  if (!recordRelation.appointment_id) {
    return NextResponse.json({ message: '予約情報が紐づいていないためLINE送信できません。' }, { status: 400 })
  }

  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, customer_id')
    .eq('id', recordRelation.appointment_id)
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

  const mediaPath =
    typeof videoRow.line_short_path === 'string' && videoRow.line_short_path.length > 0
      ? videoRow.line_short_path
      : videoRow.storage_path
  const previewPath =
    typeof videoRow.thumbnail_path === 'string' && videoRow.thumbnail_path.length > 0
      ? videoRow.thumbnail_path
      : mediaPath

  const [{ data: mediaSigned }, { data: previewSigned }] = await Promise.all([
    supabase.storage.from(VIDEO_STORAGE_BUCKET).createSignedUrl(mediaPath, 60 * 10),
    supabase.storage.from(VIDEO_STORAGE_BUCKET).createSignedUrl(previewPath, 60 * 10),
  ])
  if (!mediaSigned?.signedUrl || !previewSigned?.signedUrl) {
    return NextResponse.json({ message: '動画署名URLの生成に失敗しました。' }, { status: 500 })
  }

  const body = `${customer.full_name ?? 'お客様'}様\n本日の施術動画をお送りします。\n（${durationSec}秒）`
  const { data: queuedLog, error: logError } = await supabase
    .from('customer_notification_logs')
    .insert({
      store_id: storeId,
      customer_id: customer.id,
      appointment_id: appointment.id,
      actor_user_id: user?.id ?? null,
      channel: 'line',
      notification_type: 'other',
      status: 'queued',
      subject: '動画カルテ共有',
      body,
      target: customer.line_id,
      payload: {
        kind: 'medical_record_video_share',
        medical_record_id: recordRelation.id,
        medical_record_video_id: videoRow.id,
        duration_sec: durationSec,
      },
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (logError || !queuedLog?.id) {
    return NextResponse.json({ message: logError?.message ?? '通知ログの作成に失敗しました。' }, { status: 500 })
  }

  const sendResult = await sendLineMessage({
    to: customer.line_id,
    messages: [
      { type: 'text', text: body },
      {
        type: 'video',
        originalContentUrl: mediaSigned.signedUrl,
        previewImageUrl: previewSigned.signedUrl,
      },
    ],
  })
  if (!sendResult.success) {
    await supabase
      .from('customer_notification_logs')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        payload: {
          kind: 'medical_record_video_share',
          medical_record_id: recordRelation.id,
          medical_record_video_id: videoRow.id,
          duration_sec: durationSec,
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

  return NextResponse.json({
    ok: true,
    notificationLogId: queuedLog.id,
    medicalRecordId: recordRelation.id,
    medicalRecordVideoId: videoRow.id,
  })
}
