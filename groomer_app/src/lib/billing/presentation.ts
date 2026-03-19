export function formatBillingDateTimeJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatBillingDateOnlyJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatBillingMonthJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}

export function getBillingStatusBadgeClass(status: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700'
  if (status === 'trialing') return 'bg-blue-100 text-blue-700'
  if (status === 'past_due') return 'bg-amber-100 text-amber-800'
  if (status === 'canceled') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

export function billingOperationTypeLabel(value: string) {
  if (value === 'cancel_immediately') return '即時解約'
  if (value === 'cancel_at_period_end') return '期間終了で解約'
  if (value === 'refund_request') return '返金依頼'
  if (value === 'setup_assistance_request') return '初期設定代行申込'
  if (value === 'setup_assistance_paid') return '初期設定代行 決済完了'
  if (value === 'storage_addon_request') return '容量追加申込'
  if (value === 'storage_addon_paid') return '容量追加 決済完了'
  if (value === 'notification_usage_billing_calculated') return '通知従量課金 月次計算'
  return value
}

export function getBillingWebhookStatusClass(status: string) {
  if (status === 'failed') return 'bg-red-100 text-red-700'
  if (status === 'processed') return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-700'
}
