import Link from 'next/link'
import { getSection, manualMeta, workflows } from './manual-data'
import { ManualViewModeSwitch } from '@/components/manual/ManualViewModeSwitch'

export default function ManualPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">ユーザーマニュアル目次</h1>
          <ManualViewModeSwitch />
        </div>
        <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
          更新日: {manualMeta.updatedAt} / 対象バージョン: {manualMeta.targetVersion}
        </div>
      </header>

      <div className="space-y-3">
        {workflows.map((workflow) => (
          <article key={workflow.id} className="rounded border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{workflow.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{workflow.goal}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workflow.sectionIds.map((sectionId) => {
                const section = getSection(sectionId)
                if (!section) return null
                return (
                  <Link
                    key={`${workflow.id}-${section.id}`}
                    href={`/manual/${section.id}?flow=${workflow.id}`}
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
        <p className="mb-3 text-sm text-gray-600">横文字やシステム用語の説明は専用ページで確認できます。</p>
        <Link
          href="/manual/glossary"
          className="inline-flex rounded border px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50"
        >
          用語集ページを開く
        </Link>
      </div>
    </section>
  )
}
