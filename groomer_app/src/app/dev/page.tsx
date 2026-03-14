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
          <p className="text-sm text-red-700">このページはサポート管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">開発者管理ページ一覧</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">サブスク課金管理</h2>
          <Link
            href="/dev/subscriptions"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">管理者マニュアル</h2>
          <Link
            href="/dev/manual"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">課金アラート</h2>
          <Link
            href="/dev/billing-alerts"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">店舗チャット</h2>
          <Link
            href="/dev/support-tickets"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900">Cron 監視</h2>
          <Link
            href="/dev/cron"
            className="mt-4 inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            開く
          </Link>
        </Card>

      </div>
    </section>
  )
}
