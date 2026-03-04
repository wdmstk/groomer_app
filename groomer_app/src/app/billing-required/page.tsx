import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { PaymentMethodButtons } from '@/components/billing/PaymentMethodButtons'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function BillingRequiredPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">お支払い設定が必要です</h1>
        <p className="text-sm text-gray-600">
          試用期間が終了したか、現在の契約ステータスでは利用を継続できません。
        </p>
      </div>

      <Card>
        <div className="space-y-3 text-sm text-gray-700">
          <p>利用継続のため、下記から決済方法を選択してください。</p>
          <PaymentMethodButtons />
          <p>決済確認はWebhookで自動反映されます。反映後に通常画面へアクセスできます。</p>
          <p>解消しない場合は、店舗の owner または管理者へ連絡してください。</p>
          <div className="flex items-center gap-3">
            <Link href="/logout" className="text-red-600 hover:underline">
              ログアウト
            </Link>
          </div>
        </div>
      </Card>
    </section>
  )
}
