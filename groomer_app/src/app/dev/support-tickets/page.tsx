import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { DeveloperSupportTickets } from '@/components/support/DeveloperSupportTickets'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function DevSupportTicketsPage() {
  const auth = isPlaywrightE2E ? { ok: true } : await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">サポートチケット（開発者）</h1>
        <Card>
          <p className="text-sm text-red-700">このページはサポート管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return <DeveloperSupportTickets />
}
