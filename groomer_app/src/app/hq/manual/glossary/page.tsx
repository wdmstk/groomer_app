import Link from 'next/link'
import { hqManualGlossary, hqManualMeta } from '../manual-data'
import { requireHqManualAccess } from '../access'

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

  return (
    <section className="space-y-4">
      <header className="rounded-lg border bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">本部用語集（アルファベット文字列の説明）</h1>
        <p className="mt-2 text-xs text-gray-500">
          更新日: {hqManualMeta.updatedAt} / 対象バージョン: {hqManualMeta.targetVersion}
        </p>
        <div className="mt-4">
          <Link href="/hq/manual" className="text-sm text-blue-700 hover:underline">
            目次に戻る
          </Link>
        </div>
      </header>

      <article className="rounded-lg border bg-white p-5">
        <dl className="space-y-2 text-sm text-gray-700">
          {hqManualGlossary.map((item) => (
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
