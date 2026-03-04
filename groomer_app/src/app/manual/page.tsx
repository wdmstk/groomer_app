import Link from 'next/link'
import { getSection, manualGlossary, manualMeta, manualSections, workflows } from './manual-data'

export default function ManualPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">ユーザーマニュアル目次</h1>
        <p className="text-gray-600">
          目次のみを表示しています。内容は各項目を押すと別画面で確認できます。
        </p>
        <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
          更新日: {manualMeta.updatedAt} / 対象バージョン: {manualMeta.targetVersion}
        </div>
      </header>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">業務フロー目次</h2>
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <article key={workflow.id} className="rounded border p-3">
              <h3 className="text-base font-semibold text-gray-900">{workflow.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{workflow.goal}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workflow.sectionIds.map((sectionId) => {
                  const section = getSection(sectionId)
                  if (!section) return null
                  return (
                    <Link
                      key={`${workflow.id}-${section.id}`}
                      href={`/manual/${section.id}`}
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
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">ページ別目次</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {manualSections.map((section) => (
            <Link
              key={section.id}
              href={`/manual/${section.id}`}
              className="rounded border px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50"
            >
              {section.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">用語集（横文字の説明）</h2>
        <dl className="space-y-2 text-sm text-gray-700">
          {manualGlossary.map((item) => (
            <div key={item.term} className="rounded border p-2">
              <dt className="font-semibold text-gray-900">{item.term}</dt>
              <dd className="mt-1">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
