import Link from 'next/link'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { MemberPortalServiceError } from '@/lib/member-portal'
import { getSharedJournalPayload } from '@/lib/journal/shared'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

type SharedJournalPageProps = {
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

export default async function SharedJournalPage({ params }: SharedJournalPageProps) {
  const { token } = await params
  let payload: Awaited<ReturnType<typeof getSharedJournalPayload>> | null = null
  let unavailableMessage = ''

  try {
    payload = await getSharedJournalPayload(token)
  } catch (error) {
    if (error instanceof MemberPortalServiceError && [400, 404, 410].includes(error.status)) {
      unavailableMessage = error.message
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
            <h1 className="text-3xl font-semibold text-slate-900">日誌アルバム</h1>
          </header>
          <Card className="space-y-3 border border-slate-200 bg-white">
            <p className="text-base font-medium text-slate-900">
              {unavailableMessage || '日誌URLが無効です。'}
            </p>
            <p className="text-sm text-slate-600">
              お手数ですが、最新の日誌URLの再発行について店舗へお問い合わせください。
            </p>
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

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-medium tracking-[0.08em] text-amber-700">会員ポータル</p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{payload.customerName}様の日誌</h1>
          <p className="text-sm text-slate-600">有効期限: {formatDateTimeJst(payload.expiresAt)}</p>
          <p>
            <Link
              href={`/shared/member-portal/${encodeURIComponent(token)}`}
              className="text-sm text-amber-700 underline hover:text-amber-800"
            >
              会員証ページへ戻る
            </Link>
          </p>
        </header>

        {payload.entries.length === 0 ? (
          <Card className="space-y-2 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">投稿はまだありません</h2>
            <p className="text-sm text-slate-600">日誌が公開されるとこちらに表示されます。</p>
          </Card>
        ) : (
          <section className="space-y-3">
            {payload.entries.map((entry) => (
              <Card key={entry.id} className="space-y-2 border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDateTimeJst(entry.posted_at ?? entry.created_at)}
                  </p>
                  <p className="text-xs text-slate-500">{entry.petNames.join(' / ') || '対象ペット未設定'}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{entry.body_text || '（コメントなし）'}</p>
                {entry.media.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      写真 {entry.media.filter((media) => media.media_type === 'photo').length} 件 / 動画{' '}
                      {entry.media.filter((media) => media.media_type === 'video').length} 件
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {entry.media.map((media) => {
                        if (!media.signed_url) return null
                        return media.media_type === 'photo' ? (
                          <div key={media.id} className="relative aspect-square overflow-hidden rounded border border-slate-200">
                            <Image src={media.signed_url} alt="日誌写真" fill className="object-cover" />
                          </div>
                        ) : (
                          <video
                            key={media.id}
                            src={media.signed_url}
                            controls
                            playsInline
                            className="w-full rounded border border-slate-200 bg-black"
                          />
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">添付なし</p>
                )}
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
