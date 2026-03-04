import Link from 'next/link'
import { CronJobsManager } from '@/components/dev/CronJobsManager'
import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevCronPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Cron 監視</h1>
        <Card>
          <p className="text-sm text-red-700">このページは開発者管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">Cron 監視</h1>
          <p className="text-sm text-gray-600">
            失敗した Cron を確認し、その場で手動再実行できます。
          </p>
        </div>
        <Link
          href="/dev"
          className="inline-flex items-center rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
        >
          一覧へ戻る
        </Link>
      </div>

      <CronJobsManager />
    </section>
  )
}
