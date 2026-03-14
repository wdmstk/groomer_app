import Link from 'next/link'
import { devManualGlossary, devManualMeta } from '../manual-data'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

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

  return (
    <section className="space-y-4">
      <header className="rounded-lg border bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">管理者用語集（横文字の説明）</h1>
        <p className="mt-2 text-xs text-gray-500">
          更新日: {devManualMeta.updatedAt} / 対象バージョン: {devManualMeta.targetVersion}
        </p>
        <div className="mt-4">
          <Link href="/dev/manual" className="text-sm text-blue-700 hover:underline">
            目次に戻る
          </Link>
        </div>
      </header>

      <article className="rounded-lg border bg-white p-5">
        <dl className="space-y-2 text-sm text-gray-700">
          {devManualGlossary.map((item) => (
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
