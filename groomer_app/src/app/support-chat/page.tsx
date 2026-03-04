import { Card } from '@/components/ui/Card'
import { requireStoreSupportChatAccess } from '@/lib/auth/store-support-chat'
import { OwnerSupportChat } from '@/components/support/OwnerSupportChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SupportChatPage() {
  const auth = await requireStoreSupportChatAccess()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">問い合わせ</h1>
        <Card>
          <p className="text-sm text-red-700">{auth.message}</p>
        </Card>
      </section>
    )
  }

  return <OwnerSupportChat />
}
