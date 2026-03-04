import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSection, manualGlossary, manualMeta } from '../manual-data'

type ManualSectionPageProps = {
  params: Promise<{
    sectionId: string
  }>
}

export default async function ManualSectionPage({ params }: ManualSectionPageProps) {
  const { sectionId } = await params
  const section = getSection(sectionId)

  if (!section) {
    notFound()
  }

  return (
    <section className="space-y-4">
      <header className="rounded-lg border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">{section.title}</h1>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{section.path}</span>
        </div>
        <p className="text-sm text-gray-700">{section.purpose}</p>
        <p className="mt-2 text-xs text-gray-500">
          更新日: {manualMeta.updatedAt} / 対象バージョン: {manualMeta.targetVersion}
        </p>
        <div className="mt-4">
          <Link href="/manual" className="text-sm text-blue-700 hover:underline">
            目次に戻る
          </Link>
        </div>
      </header>

      <article className="rounded-lg border bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">操作手順</h2>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          {section.procedures.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>

        <h2 className="mb-2 text-sm font-semibold text-gray-900">注意点</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {section.cautions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="rounded-lg border bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">用語集（横文字の説明）</h2>
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
