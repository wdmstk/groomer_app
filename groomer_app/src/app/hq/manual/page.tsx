import Link from 'next/link'
import { hqManualMeta, hqWorkflows, getHqSection } from './manual-data'
import { requireHqManualAccess } from './access'

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
    <section className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">本部管理マニュアル目次</h1>
        <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
          更新日: {hqManualMeta.updatedAt} / 対象バージョン: {hqManualMeta.targetVersion}
        </div>
      </header>

      <div className="space-y-3">
        {hqWorkflows.map((workflow) => (
          <article key={workflow.id} className="rounded border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{workflow.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{workflow.goal}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workflow.sectionIds.map((sectionId) => {
                const section = getHqSection(sectionId)
                if (!section) return null
                return (
                  <Link
                    key={`${workflow.id}-${section.id}`}
                    href={`/hq/manual/${section.id}?flow=${workflow.id}`}
                    className="rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    {section.title}
                  </Link>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">用語集</h2>
        <p className="mb-3 text-sm text-gray-600">アルファベット文字列やAPI項目名の意味を確認できます。</p>
        <Link
          href="/hq/manual/glossary"
          className="inline-flex rounded border px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50"
        >
          用語集ページを開く
        </Link>
      </div>
    </section>
  )
}
