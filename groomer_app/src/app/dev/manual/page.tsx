import Link from 'next/link'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { devManualMeta, devWorkflows, getDevSection } from './manual-data'

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
    <section className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">管理者マニュアル目次</h1>
        <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
          更新日: {devManualMeta.updatedAt} / 対象バージョン: {devManualMeta.targetVersion}
        </div>
      </header>

      <div className="space-y-3">
        {devWorkflows.map((workflow) => (
          <article key={workflow.id} className="rounded border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{workflow.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{workflow.goal}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workflow.sectionIds.map((sectionId) => {
                const section = getDevSection(sectionId)
                if (!section) return null
                return (
                  <Link
                    key={`${workflow.id}-${section.id}`}
                    href={`/dev/manual/${section.id}?flow=${workflow.id}`}
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
        <p className="mb-3 text-sm text-gray-600">管理者画面で使う用語は専用ページで確認できます。</p>
        <Link
          href="/dev/manual/glossary"
          className="inline-flex rounded border px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50"
        >
          用語集ページを開く
        </Link>
      </div>
    </section>
  )
}
