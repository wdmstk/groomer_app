import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevHomePage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">開発者管理ページ一覧</h1>
        <Card>
          <p className="text-sm text-red-700">このページは開発者管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">開発者管理ページ一覧</h1>
        <p className="text-sm text-gray-600">
          本番運用に影響する設定を管理します。通常スタッフ画面とは権限が分離されています。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">サブスク課金管理</h2>
          <p className="mt-2 text-sm text-gray-600">
            店舗ごとの課金ステータス、試用期間、課金メモを更新します。
          </p>
          <Link
            href="/dev/subscriptions"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">管理者マニュアル</h2>
          <p className="mt-2 text-sm text-gray-600">
            各入力項目の意味、試用期限判定、運用ルールを確認できます。
          </p>
          <Link
            href="/dev/manual"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">課金アラート</h2>
          <p className="mt-2 text-sm text-gray-600">
            試用期限接近・past_due・canceled の店舗を一覧で監視できます。
          </p>
          <Link
            href="/dev/billing-alerts"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">店舗チャット</h2>
          <p className="mt-2 text-sm text-gray-600">
            各店舗オーナーからの問い合わせを店舗単位で確認し、返信できます。
          </p>
          <Link
            href="/dev/support-chat"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">Cron 監視</h2>
          <p className="mt-2 text-sm text-gray-600">
            失敗した Cron 実行履歴を確認し、必要なジョブを手動再実行できます。
          </p>
          <Link
            href="/dev/cron"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">予約作成KPI</h2>
          <p className="mt-2 text-sm text-gray-600">
            予約入力の作成時間・クリック数・前回コピー利用率の日次推移を確認できます。
          </p>
          <Link
            href="/dev/appointments-kpi"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>
      </div>
    </section>
  )
}
