import { ManualGlossaryPage } from '@/components/manual/ManualPages'
import { requireHqManualAccess } from '../access'
import { hqManualGlossary, hqManualMeta } from '../manual-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HqManualGlossaryPage() {
  const access = await requireHqManualAccess()
  if (!access.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">本部管理マニュアル用語集</h1>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-red-700">{access.message}</p>
        </div>
      </section>
    )
  }

  return <ManualGlossaryPage title="本部用語集（横文字・ステータスの説明）" meta={hqManualMeta} glossary={hqManualGlossary} indexHref="/hq/manual" />
}
