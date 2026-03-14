import Link from 'next/link'
import { manualGlossary, manualMeta } from '../manual-data'

export default function ManualGlossaryPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">用語集（横文字の説明）</h1>
        </div>
        <p className="text-xs text-gray-500">
          更新日: {manualMeta.updatedAt} / 対象バージョン: {manualMeta.targetVersion}
        </p>
        <div className="mt-4">
          <Link href="/manual" className="text-sm text-blue-700 hover:underline">
            目次に戻る
          </Link>
        </div>
      </header>

      <article className="rounded-lg border bg-white p-5">
        <dl className="space-y-2 text-sm text-gray-700">
          {manualGlossary.map((item) => (
            <div key={item.term} className="rounded border p-2">
              <dt className="font-semibold text-gray-900">{item.term}</dt>
              <dd className="mt-1">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  )
}
