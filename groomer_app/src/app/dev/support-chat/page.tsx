import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { DeveloperSupportChat } from '@/components/support/DeveloperSupportChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevSupportChatPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">店舗問い合わせチャット</h1>
        <Card>
          <p className="text-sm text-red-700">このページは開発者管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return <DeveloperSupportChat />
}
