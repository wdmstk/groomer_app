import { ManualIndexPage } from '@/components/manual/ManualPages'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { devManualMeta, devManualSections, devWorkflows } from './manual-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevManualPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">管理者マニュアル</h1>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-red-700">このページはサポート管理者のみアクセスできます。</p>
        </div>
      </section>
    )
  }

  return (
    <ManualIndexPage
      title="管理者マニュアル目次"
      meta={devManualMeta}
      workflows={devWorkflows}
      sections={devManualSections}
      sectionBaseHref="/dev/manual"
      glossaryHref="/dev/manual/glossary"
      glossaryDescription="管理者画面で使う横文字、ジョブ状態、課金状態の意味を確認できます。"
    />
  )
}
