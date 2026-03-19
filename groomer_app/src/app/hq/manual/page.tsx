import { ManualIndexPage } from '@/components/manual/ManualPages'
import { requireHqManualAccess } from './access'
import { hqManualMeta, hqManualSections, hqWorkflows } from './manual-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HqManualPage() {
  const access = await requireHqManualAccess()
  if (!access.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">本部管理マニュアル</h1>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-red-700">{access.message}</p>
        </div>
      </section>
    )
  }

  return (
    <ManualIndexPage
      title="本部管理マニュアル目次"
      meta={hqManualMeta}
      workflows={hqWorkflows}
      sections={hqManualSections}
      sectionBaseHref="/hq/manual"
      glossaryHref="/hq/manual/glossary"
      glossaryDescription="本部画面で使う横文字、内部値、ステータスの意味を確認できます。"
    />
  )
}
