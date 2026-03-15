export function formatLineDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatLineDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  )
}

const DEFAULT_SLOT_REOFFER_LINE_TEMPLATE = `{{customer_name}}様
キャンセル枠がご案内可能になりました。

日時: {{appointment_range}}
メニュー: {{menu}}
対象: {{pet_name}}

{{note}}
先着順のため、埋まり次第ご案内終了となります。`

const DEFAULT_FOLLOWUP_LINE_TEMPLATE = `{{customer_name}}様
いつもありがとうございます。前回ご来店日（{{last_visit_date}}）から45日が経過したため、ご連絡しました。
次回のおすすめ来店日は {{recommended_date}} 前後です。ご都合の良い日時をご連絡ください。`

const DEFAULT_NEXT_VISIT_SUGGESTION_LINE_TEMPLATE = `{{customer_name}}様
{{pet_name}}ちゃんの次回来店のおすすめ時期が近づいています。

前回施術日: {{last_visit_date}}
おすすめ来店日: {{recommended_date}}
目安: {{recommendation_reason}}

ご都合の良い日時があれば、そのままご返信ください。`

const DEFAULT_REMINDER_LINE_TEMPLATE = `{{customer_name}}様、明日のトリミング予約のご案内です。
店舗: {{store_name}}
日時: {{appointment_range}}
メニュー: {{menu}}
ご来店を心よりお待ちしております。`

const DEFAULT_REMINDER_EMAIL_SUBJECT = `【リマインド】明日のご予約について: {{menu}}`

const DEFAULT_REMINDER_EMAIL_TEMPLATE = `{{customer_name}}様

明日のトリミング予約のご案内です。
店舗: {{store_name}}
日時: {{appointment_range}}
メニュー: {{menu}}

ご来店を心よりお待ちしております。`

const DEFAULT_HOTEL_STAY_REPORT_LINE_TEMPLATE = `{{customer_name}}様
{{pet_name}}ちゃんの宿泊レポートをお送りします。

現在ステータス: {{stay_status}}
チェックイン予定: {{planned_check_in_at}}
チェックアウト予定: {{planned_check_out_at}}

{{report_body}}

ご不明点があれば店舗までご連絡ください。`

const DEFAULT_MEDICAL_RECORD_SHARE_LINE_TEMPLATE = `{{customer_name}}様
{{pet_name}}ちゃんの写真カルテをご案内します。

こちらからご確認ください。
{{share_url}}`

export function getDefaultSlotReofferLineTemplate() {
  return DEFAULT_SLOT_REOFFER_LINE_TEMPLATE
}

export function getDefaultFollowupLineTemplate() {
  return DEFAULT_FOLLOWUP_LINE_TEMPLATE
}

export function getDefaultNextVisitSuggestionLineTemplate() {
  return DEFAULT_NEXT_VISIT_SUGGESTION_LINE_TEMPLATE
}

export function getDefaultReminderLineTemplate() {
  return DEFAULT_REMINDER_LINE_TEMPLATE
}

export function getDefaultReminderEmailSubjectTemplate() {
  return DEFAULT_REMINDER_EMAIL_SUBJECT
}

export function getDefaultReminderEmailTemplate() {
  return DEFAULT_REMINDER_EMAIL_TEMPLATE
}

export function getDefaultHotelStayReportLineTemplate() {
  return DEFAULT_HOTEL_STAY_REPORT_LINE_TEMPLATE
}

export function getDefaultMedicalRecordShareLineTemplate() {
  return DEFAULT_MEDICAL_RECORD_SHARE_LINE_TEMPLATE
}

export function getHotelStayStatusLabel(status: string) {
  if (status === 'reserved') return '予約'
  if (status === 'checked_in') return 'チェックイン中'
  if (status === 'checked_out') return 'チェックアウト済み'
  if (status === 'canceled') return 'キャンセル'
  if (status === 'no_show') return '無断キャンセル'
  return status
}

export function renderSlotReofferLineTemplate(params: {
  customerName: string
  menu: string
  petName: string | null
  startTime: string
  endTime: string
  note?: string | null
  templateBody?: string | null
}) {
  const appointmentRange = `${formatLineDateTime(params.startTime)} - ${formatLineDateTime(params.endTime)}`
  return fillTemplate(params.templateBody ?? DEFAULT_SLOT_REOFFER_LINE_TEMPLATE, {
    customer_name: params.customerName,
    appointment_range: appointmentRange,
    menu: params.menu,
    pet_name: params.petName ?? 'ペット未指定',
    note: params.note ?? 'ご希望の場合は店舗までご連絡ください。',
  })
}

export function renderFollowupLineTemplate(params: {
  customerName: string
  lastVisitAt: string
  recommendedAt: string
  templateBody?: string | null
}) {
  return fillTemplate(params.templateBody ?? DEFAULT_FOLLOWUP_LINE_TEMPLATE, {
    customer_name: params.customerName,
    last_visit_date: formatLineDate(params.lastVisitAt),
    recommended_date: formatLineDate(params.recommendedAt),
  })
}

export function renderNextVisitSuggestionLineTemplate(params: {
  customerName: string
  petName: string
  lastVisitAt: string
  recommendedAt: string
  recommendationReason: string
  templateBody?: string | null
}) {
  return fillTemplate(params.templateBody ?? DEFAULT_NEXT_VISIT_SUGGESTION_LINE_TEMPLATE, {
    customer_name: params.customerName,
    pet_name: params.petName,
    last_visit_date: formatLineDate(params.lastVisitAt),
    recommended_date: formatLineDate(params.recommendedAt),
    recommendation_reason: params.recommendationReason,
  })
}

export function renderReminderTemplate(params: {
  customerName: string
  storeName: string
  menu: string
  startTime: string
  endTime?: string | null
  subjectTemplate?: string | null
  bodyTemplate?: string | null
}) {
  const appointmentRange = params.endTime
    ? `${formatLineDateTime(params.startTime)} - ${formatLineDateTime(params.endTime)}`
    : formatLineDateTime(params.startTime)
  const values = {
    customer_name: params.customerName,
    store_name: params.storeName,
    menu: params.menu,
    appointment_range: appointmentRange,
  }
  return {
    subject: fillTemplate(params.subjectTemplate ?? DEFAULT_REMINDER_EMAIL_SUBJECT, values),
    body: fillTemplate(params.bodyTemplate ?? DEFAULT_REMINDER_LINE_TEMPLATE, values),
  }
}

export function renderHotelStayReportLineTemplate(params: {
  customerName: string
  petName: string
  stayStatus: string
  plannedCheckInAt: string
  plannedCheckOutAt: string
  reportBody: string
  templateBody?: string | null
}) {
  return fillTemplate(params.templateBody ?? DEFAULT_HOTEL_STAY_REPORT_LINE_TEMPLATE, {
    customer_name: params.customerName,
    pet_name: params.petName,
    stay_status: getHotelStayStatusLabel(params.stayStatus),
    planned_check_in_at: formatLineDateTime(params.plannedCheckInAt),
    planned_check_out_at: formatLineDateTime(params.plannedCheckOutAt),
    report_body: params.reportBody,
  })
}

export function renderMedicalRecordShareLineTemplate(params: {
  customerName: string
  petName: string
  shareUrl: string
  templateBody?: string | null
}) {
  return fillTemplate(params.templateBody ?? DEFAULT_MEDICAL_RECORD_SHARE_LINE_TEMPLATE, {
    customer_name: params.customerName,
    pet_name: params.petName,
    share_url: params.shareUrl,
  })
}
