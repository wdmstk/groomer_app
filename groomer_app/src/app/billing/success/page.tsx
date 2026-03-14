import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    provider?: string
    mode?: string
  }>
}

export default async function BillingSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const mode = params?.mode ?? ''
  const isSetupAssistance = mode === 'setup-assistance'
  const isStorageAddon = mode === 'storage-addon'

  return (
    <section className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">決済処理を受け付けました</h1>
      </div>

      <Card>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            {isSetupAssistance
              ? '初期設定代行の申込を受け付けました。運営側で確認後、設定作業を開始します。'
              : isStorageAddon
                ? '容量追加の決済を受け付けました。反映まで数秒〜数分かかる場合があります。'
                : 'ステータス反映まで数秒〜数分かかる場合があります。'}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
            >
              ダッシュボードへ
            </Link>
            <Link href="/billing-required" className="text-gray-600 hover:underline">
              決済画面へ戻る
            </Link>
          </div>
        </div>
      </Card>
    </section>
  )
}
