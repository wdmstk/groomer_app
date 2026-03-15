import { NextResponse } from 'next/server'
import type { Message } from '@line/bot-sdk'
import { sendLineMessage } from '@/lib/line'
import { sendEmail } from '@/lib/resend'
import {
  getDefaultFollowupLineTemplate,
  getDefaultHotelStayReportLineTemplate,
  getDefaultNextVisitSuggestionLineTemplate,
  getDefaultReminderEmailSubjectTemplate,
  getDefaultReminderEmailTemplate,
  getDefaultReminderLineTemplate,
  getDefaultSlotReofferLineTemplate,
  renderFollowupLineTemplate,
  renderHotelStayReportLineTemplate,
  renderNextVisitSuggestionLineTemplate,
  renderReminderTemplate,
  renderSlotReofferLineTemplate,
} from '@/lib/notification-templates'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asObjectOrNull } from '@/lib/object-utils'

type TemplateKey =
  | 'slot_reoffer_line'
  | 'followup_line'
  | 'next_visit_suggestion_line'
  | 'reminder_line'
  | 'reminder_email'
  | 'hotel_stay_report_line'

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)

  const templateKey =
    body?.template_key === 'slot_reoffer_line' ||
    body?.template_key === 'followup_line' ||
    body?.template_key === 'next_visit_suggestion_line' ||
    body?.template_key === 'reminder_line' ||
    body?.template_key === 'reminder_email' ||
    body?.template_key === 'hotel_stay_report_line'
      ? (body.template_key as TemplateKey)
      : null
  const channel =
    body?.channel === 'line' || body?.channel === 'email' ? body.channel : null
  const target = typeof body?.target === 'string' ? body.target.trim() : ''

  if (!templateKey || !channel || !target) {
    return NextResponse.json({ message: 'template_key, channel, target は必須です。' }, { status: 400 })
  }

  const fallbackBody =
    templateKey === 'slot_reoffer_line'
      ? getDefaultSlotReofferLineTemplate()
      : templateKey === 'followup_line'
        ? getDefaultFollowupLineTemplate()
        : templateKey === 'next_visit_suggestion_line'
          ? getDefaultNextVisitSuggestionLineTemplate()
        : templateKey === 'reminder_line'
          ? getDefaultReminderLineTemplate()
          : templateKey === 'hotel_stay_report_line'
            ? getDefaultHotelStayReportLineTemplate()
            : getDefaultReminderEmailTemplate()
  const fallbackSubject =
    templateKey === 'reminder_email'
      ? getDefaultReminderEmailSubjectTemplate()
      : templateKey === 'followup_line'
      ? '再来店フォロー'
      : templateKey === 'next_visit_suggestion_line'
        ? '次回来店のご提案'
      : templateKey === 'slot_reoffer_line'
          ? 'キャンセル枠のご案内'
          : templateKey === 'hotel_stay_report_line'
            ? '宿泊レポート'
          : '前日リマインド'

  const templateBody = typeof body?.body === 'string' && body.body.trim() ? body.body.trim() : fallbackBody
  const templateSubject =
    typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim() : fallbackSubject

  const storeName =
    (await supabase.from('stores').select('name').eq('id', storeId).maybeSingle()).data?.name ?? '店舗名未設定'

  const rendered =
    templateKey === 'slot_reoffer_line'
      ? {
          subject: templateSubject,
          body: renderSlotReofferLineTemplate({
            customerName: 'テスト顧客',
            menu: 'シャンプーコース',
            petName: 'テスト犬',
            startTime: '2026-03-02T10:00:00+09:00',
            endTime: '2026-03-02T11:30:00+09:00',
            note: 'ご希望の場合は店舗までご連絡ください。',
            templateBody,
          }),
        }
      : templateKey === 'followup_line'
        ? {
            subject: templateSubject,
            body: renderFollowupLineTemplate({
              customerName: 'テスト顧客',
              lastVisitAt: '2026-01-10T10:00:00+09:00',
              recommendedAt: '2026-02-24T10:00:00+09:00',
              templateBody,
            }),
          }
        : templateKey === 'next_visit_suggestion_line'
          ? {
              subject: templateSubject,
              body: renderNextVisitSuggestionLineTemplate({
                customerName: 'テスト顧客',
                petName: 'テスト犬',
                lastVisitAt: '2026-02-01T10:00:00+09:00',
                recommendedAt: '2026-03-18T10:00:00+09:00',
                recommendationReason: '犬種: トイプードル / 毛量: 多め / 施術後38日目安',
                templateBody,
              }),
            }
        : templateKey === 'hotel_stay_report_line'
          ? {
              subject: templateSubject,
              body: renderHotelStayReportLineTemplate({
                customerName: 'テスト顧客',
                petName: 'テスト犬',
                stayStatus: 'checked_in',
                plannedCheckInAt: '2026-03-02T10:00:00+09:00',
                plannedCheckOutAt: '2026-03-03T10:00:00+09:00',
                reportBody: '本日は食欲・体調ともに安定しています。お散歩も問題なく完了しました。',
                templateBody,
              }),
            }
        : renderReminderTemplate({
            customerName: 'テスト顧客',
            storeName,
            menu: 'カットコース',
            startTime: '2026-03-02T10:00:00+09:00',
            endTime: '2026-03-02T11:30:00+09:00',
            subjectTemplate: templateSubject,
            bodyTemplate: templateBody,
          })

  if (channel === 'line') {
    const messages: Message[] = [{ type: 'text', text: rendered.body }]
    const result = await sendLineMessage({ to: target, messages })
    if (!result.success) {
      return NextResponse.json({ message: result.error ?? 'LINE送信に失敗しました。' }, { status: 500 })
    }
  } else {
    const result = await sendEmail({
      to: target,
      subject: rendered.subject,
      html: rendered.body.replaceAll('\n', '<br />'),
    })
    if (!result.success) {
      return NextResponse.json({ message: result.error ?? 'メール送信に失敗しました。' }, { status: 500 })
    }
  }

  await supabase.from('customer_notification_logs').insert({
    store_id: storeId,
    actor_user_id: user?.id ?? null,
    channel,
    notification_type: 'test_send',
    status: 'sent',
    subject: rendered.subject,
    body: rendered.body,
    target,
    payload: {
      template_key: templateKey,
      target,
      mode: 'test_send',
    },
    sent_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
