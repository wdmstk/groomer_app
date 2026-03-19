import { ManualGlossaryPage } from '@/components/manual/ManualPages'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { devManualGlossary, devManualMeta } from '../manual-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevManualGlossaryPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">管理者マニュアル用語集</h1>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-red-700">このページはサポート管理者のみアクセスできます。</p>
        </div>
      </section>
    )
  }

  return <ManualGlossaryPage title="管理者用語集（横文字・ステータスの説明）" meta={devManualMeta} glossary={devManualGlossary} indexHref="/dev/manual" />
}
