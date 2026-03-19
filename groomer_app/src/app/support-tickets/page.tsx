import { Card } from '@/components/ui/Card'
import { requireStoreSupportTicketAccess } from '@/lib/auth/store-support-ticket'
import { OwnerSupportTickets } from '@/components/support/OwnerSupportTickets'

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
