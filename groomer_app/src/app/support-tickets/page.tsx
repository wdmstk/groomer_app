import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { requireStoreSupportTicketAccess } from '@/lib/auth/store-support-ticket'

const OwnerSupportTickets = nextDynamic(
  () => import('@/components/support/OwnerSupportTickets').then((mod) => mod.OwnerSupportTickets),
  {
    loading: () => (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">問い合わせチケット</h1>
        <Card>
          <p className="text-sm text-gray-500">問い合わせチケットを読み込み中...</p>
        </Card>
      </section>
    ),
  }
)

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function SupportTicketsPage() {
  const auth = isPlaywrightE2E ? { ok: true } : await requireStoreSupportTicketAccess()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">問い合わせチケット</h1>
        <Card>
          <p className="text-sm text-red-700">{auth.message}</p>
        </Card>
      </section>
    )
  }

  return <OwnerSupportTickets />
}
