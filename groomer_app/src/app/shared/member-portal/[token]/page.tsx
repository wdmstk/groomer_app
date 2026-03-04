import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { getMemberPortalPayload, MemberPortalServiceError } from '@/lib/member-portal'

type SharedMemberPortalPageProps = {
  params: Promise<{
    token: string
  }>
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
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

export default async function SharedMemberPortalPage({
  params,
}: SharedMemberPortalPageProps) {
  const { token } = await params

  try {
    const payload = await getMemberPortalPayload(token)

    return (
      <main className="min-h-screen bg-amber-50 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
              Member Portal
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">{payload.memberCard.label}</h1>
            <p className="text-sm text-slate-600">
              有効期限: {formatDateTimeJst(payload.memberCard.expiresAt)}
            </p>
          </header>

          <Card className="space-y-3 border border-amber-100 bg-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Customer
            </p>
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-slate-900">{payload.customer.full_name}</p>
              <p className="text-sm text-slate-600">{payload.store.name}</p>
            </div>
          </Card>

          <Card className="space-y-4 border border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Next Appointment
                </p>
                <h2 className="text-xl font-semibold text-slate-900">次回予約</h2>
              </div>
              {payload.nextAppointment ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {payload.nextAppointment.status ?? '予約済'}
                </span>
              ) : null}
            </div>

            {payload.nextAppointment ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">日時</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {formatDateTimeJst(payload.nextAppointment.start_time)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">メニュー</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {payload.nextAppointment.menu ?? '未設定'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">担当スタッフ</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {payload.nextAppointment.staff_name ?? '未定'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">ペット</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {payload.nextAppointment.pet_name ?? '未設定'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">
                現在、確認できる次回予約はありません。ご不明点があれば店舗へご連絡ください。
              </p>
            )}

            <div className="pt-2">
              <Link
                href={`/reserve/${payload.store.id}?member_portal_token=${encodeURIComponent(token)}`}
                className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                この内容で予約する
              </Link>
            </div>
          </Card>

          <Card className="space-y-3 border border-slate-200">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Announcements
              </p>
              <h2 className="text-xl font-semibold text-slate-900">お知らせ</h2>
            </div>
            <p className="text-sm text-slate-600">現在表示できるお知らせはありません。</p>
          </Card>
        </div>
      </main>
    )
  } catch (error) {
    if (
      error instanceof MemberPortalServiceError &&
      [400, 404, 410].includes(error.status)
    ) {
      notFound()
    }
    throw error
  }
}
