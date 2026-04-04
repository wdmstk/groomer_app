import Link from 'next/link'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { MemberPortalWaitlistCard } from '@/components/member-portal/MemberPortalWaitlistCard'
import { MemberPortalReissueRequestButton } from '@/components/member-portal/MemberPortalReissueRequestButton'
import { getMemberPortalPayload, MemberPortalServiceError } from '@/lib/member-portal'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

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

function formatYen(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '未登録'
  return `${Math.round(value).toLocaleString()} 円`
}

function getMemberRankBadge(rank: string | null | undefined) {
  switch (rank) {
    case 'ゴールド':
      return {
        label: 'ゴールド',
        className: 'bg-amber-100 text-amber-900 border-amber-300',
      }
    case 'シルバー':
      return {
        label: 'シルバー',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
      }
    case 'ブロンズ':
      return {
        label: 'ブロンズ',
        className: 'bg-orange-100 text-orange-900 border-orange-300',
      }
    default:
      return {
        label: 'スタンダード',
        className: 'bg-sky-100 text-sky-800 border-sky-300',
      }
  }
}

export default async function SharedMemberPortalPage({
  params,
}: SharedMemberPortalPageProps) {
  const { token } = await params
  let payload: Awaited<ReturnType<typeof getMemberPortalPayload>> | null = null
  let unavailableMessage = ''
  let unavailableStatus: number | null = null

  try {
    payload = await getMemberPortalPayload(token)
  } catch (error) {
    if (
      error instanceof MemberPortalServiceError &&
      [400, 404, 410].includes(error.status)
    ) {
      unavailableMessage = error.message
      unavailableStatus = error.status
    } else {
      throw error
    }
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-amber-50 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-medium tracking-[0.08em] text-amber-700">会員ポータル</p>
            <h1 className="text-3xl font-semibold text-slate-900">会員証ページ</h1>
          </header>
          <Card className="space-y-3 border border-slate-200 bg-white">
            <p className="text-base font-medium text-slate-900">
              {unavailableMessage || '会員証URLが無効です。'}
            </p>
            <p className="text-sm text-slate-600">
              お手数ですが、最新の会員証URLの再発行について店舗へお問い合わせください。
            </p>
            {unavailableStatus === 410 && unavailableMessage.includes('有効期限切れ') ? (
              <MemberPortalReissueRequestButton token={token} />
            ) : null}
            <p>
              <Link href="/" className="text-sm text-amber-700 underline hover:text-amber-800">
                トップへ戻る
              </Link>
            </p>
          </Card>
        </div>
      </main>
    )
  }

  const rankBadge = payload.memberCard.rank ? getMemberRankBadge(payload.memberCard.rank) : null

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-medium tracking-[0.08em] text-amber-700">会員ポータル</p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {payload.memberCard.label}
          </h1>
          <p className="text-sm text-slate-600">
            有効期限: {formatDateTimeJst(payload.memberCard.expiresAt)}
          </p>
        </header>

        <Card className="space-y-3 border border-amber-100 bg-white">
          <p className="text-xs font-semibold tracking-[0.08em] text-amber-700">ご利用者情報</p>
          <div className="space-y-1">
            <p className="text-2xl font-semibold text-slate-900">{payload.customer.full_name}様</p>
            <p className="text-sm text-slate-600">{payload.store.name}</p>
            {rankBadge ? (
              <p className="pt-1">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${rankBadge.className}`}
                >
                  会員ランク: {rankBadge.label}
                </span>
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-4 border border-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">ご予約情報</p>
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

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/reserve/${payload.store.id}?member_portal_token=${encodeURIComponent(token)}&mode=repeat`}
              className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              前回と同じ施術内容で予約する
            </Link>
            <Link
              href={`/reserve/${payload.store.id}?member_portal_token=${encodeURIComponent(token)}&mode=new`}
              className="inline-flex items-center rounded border border-amber-600 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              新規予約
            </Link>
          </div>
          <div>
            <p className="mt-2 text-xs text-slate-500">
              日時は引き継がれません。予約フォームで新しい希望日時をご指定ください。
            </p>
          </div>
        </Card>

        <Card className="space-y-3 border border-slate-200">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">次回来店目安</p>
            <h2 className="text-xl font-semibold text-slate-900">次回来店案内</h2>
          </div>
          {payload.nextVisitSuggestion ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                推奨日: {formatDateTimeJst(payload.nextVisitSuggestion.recommended_date)}
              </p>
              <p className="mt-1">{payload.nextVisitSuggestion.reason}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              次回予約があるため、個別の来店目安表示は省略しています。
            </p>
          )}
        </Card>

        <Card className="space-y-3 border border-slate-200">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">来店履歴</p>
            <h2 className="text-xl font-semibold text-slate-900">来店履歴</h2>
          </div>
          {payload.visitHistory.length === 0 ? (
            <p className="text-sm text-slate-600">表示できる来店履歴はありません。</p>
          ) : (
            <div className="space-y-2">
              {payload.visitHistory.map((visit) => (
                <article key={visit.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{formatDateTimeJst(visit.visit_date)}</p>
                  <p className="text-slate-700">メニュー: {visit.menu ?? '未登録'}</p>
                  <p className="text-slate-700">担当: {visit.staff_name ?? '未登録'}</p>
                  <p className="text-slate-700">会計: {formatYen(visit.total_amount)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3 border border-slate-200">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">日誌</p>
            <h2 className="text-xl font-semibold text-slate-900">お預かり中の様子</h2>
          </div>
          <p className="text-sm text-slate-600">
            トリマーが公開した日誌（写真・動画・コメント）を確認できます。
          </p>
          <p>
            <Link
              href={`/shared/journal/${encodeURIComponent(token)}`}
              className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              日誌アルバムを見る
            </Link>
          </p>
        </Card>

        <MemberPortalWaitlistCard token={token} />

        <Card className="space-y-3 border border-slate-200">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">お知らせ</p>
            <h2 className="text-xl font-semibold text-slate-900">お知らせ</h2>
          </div>
          {payload.announcements.length === 0 ? (
            <p className="text-sm text-slate-600">現在表示できるお知らせはありません。</p>
          ) : (
            <div className="space-y-2">
              {payload.announcements.map((announcement) => (
                <article key={announcement.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{announcement.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{announcement.body}</p>
                </article>
              ))}
              <p className="text-xs text-slate-500">
                通知最適化: 重要度の高いお知らせのみ最大2件を表示しています。
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
