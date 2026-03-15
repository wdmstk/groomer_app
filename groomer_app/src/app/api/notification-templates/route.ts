import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asObjectOrNull } from '@/lib/object-utils'
import {
  getDefaultFollowupLineTemplate,
  getDefaultHotelStayReportLineTemplate,
  getDefaultMedicalRecordShareLineTemplate,
  getDefaultReminderEmailSubjectTemplate,
  getDefaultReminderEmailTemplate,
  getDefaultReminderLineTemplate,
  getDefaultSlotReofferLineTemplate,
} from '@/lib/notification-templates'

const DEFAULT_TEMPLATES = {
  slot_reoffer_line: {
    subject: 'キャンセル枠のご案内',
    body: getDefaultSlotReofferLineTemplate(),
  },
  followup_line: {
    subject: '再来店フォロー',
    body: getDefaultFollowupLineTemplate(),
  },
  reminder_line: {
    subject: '前日リマインド',
    body: getDefaultReminderLineTemplate(),
  },
  reminder_email: {
    subject: getDefaultReminderEmailSubjectTemplate(),
    body: getDefaultReminderEmailTemplate(),
  },
  hotel_stay_report_line: {
    subject: '宿泊レポート',
    body: getDefaultHotelStayReportLineTemplate(),
  },
  medical_record_share_line: {
    subject: '写真カルテ共有',
    body: getDefaultMedicalRecordShareLineTemplate(),
  },
} as const

const NOTIFICATION_SCOPE_TEMPLATE_KEYS = [
  'slot_reoffer_line',
  'followup_line',
  'reminder_line',
  'reminder_email',
  'medical_record_share_line',
] as const

const ALL_TEMPLATE_KEYS = [
  ...NOTIFICATION_SCOPE_TEMPLATE_KEYS,
  'hotel_stay_report_line',
] as const

export async function GET(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const url = new URL(request.url)
  const scope = url.searchParams.get('scope')
  const targetTemplateKeys =
    scope === 'notifications'
      ? [...NOTIFICATION_SCOPE_TEMPLATE_KEYS]
      : [...ALL_TEMPLATE_KEYS]

  const { data, error } = await supabase
    .from('notification_templates')
    .select('template_key, channel, subject, body, is_active')
    .eq('store_id', storeId)
    .in('template_key', targetTemplateKeys)

  if (error && !error.message.includes('notification_templates')) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const rows = ((data ?? []) as Array<{
    template_key: string
    channel: string
    subject: string | null
    body: string
    is_active: boolean
  }>).reduce<Record<string, { subject: string | null; body: string; is_active: boolean }>>(
    (acc, row) => {
      acc[row.template_key] = {
        subject: row.subject,
        body: row.body,
        is_active: row.is_active,
      }
      return acc
    },
    {}
  )

  const templates = targetTemplateKeys.reduce<
    Record<string, { subject: string | null; body: string; is_active: boolean }>
  >((acc, key) => {
    acc[key] = rows[key] ?? {
      ...DEFAULT_TEMPLATES[key],
      is_active: true,
    }
    return acc
  }, {})

  return NextResponse.json({ templates })
}

export async function PATCH(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)

  const templateKey =
    body?.template_key === 'slot_reoffer_line' ||
    body?.template_key === 'followup_line' ||
    body?.template_key === 'reminder_line' ||
    body?.template_key === 'reminder_email' ||
    body?.template_key === 'hotel_stay_report_line' ||
    body?.template_key === 'medical_record_share_line'
      ? body.template_key
      : null
  const channel =
    body?.channel === 'line' || body?.channel === 'email' ? body.channel : null
  const subject = typeof body?.subject === 'string' ? body.subject : null
  const bodyText = typeof body?.body === 'string' ? body.body.trim() : ''
  const isActive = typeof body?.is_active === 'boolean' ? body.is_active : true

  if (!templateKey || !channel || !bodyText) {
    return NextResponse.json({ message: 'template_key, channel, body は必須です。' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notification_templates')
    .upsert(
      {
        store_id: storeId,
        template_key: templateKey,
        channel,
        subject,
        body: bodyText,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,template_key,channel' }
    )
    .select('template_key, channel, subject, body, is_active')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}
