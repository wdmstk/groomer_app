import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getHqSection,
  getHqSectionGuide,
  getHqSectionInsight,
  hqManualMeta,
  hqManualSections,
  hqWorkflows,
} from '../manual-data'
import { requireHqManualAccess } from '../access'

type HqManualSectionPageProps = {
  params: Promise<{
    sectionId: string
  }>
  searchParams?: Promise<{
    flow?: string
  }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HqManualSectionPage({ params, searchParams }: HqManualSectionPageProps) {
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

  const { sectionId } = await params
  const resolvedSearchParams = await searchParams
  const section = getHqSection(sectionId)
  if (!section) notFound()

  const guide = getHqSectionGuide(sectionId)
  const insight = getHqSectionInsight(sectionId, section)
  const requestedFlowId = resolvedSearchParams?.flow
  const flowByQuery = hqWorkflows.find((flow) => flow.id === requestedFlowId && flow.sectionIds.includes(section.id))
  const flowByContain = hqWorkflows.find((flow) => flow.sectionIds.includes(section.id))
  const activeFlow = flowByQuery ?? flowByContain ?? null
  const sequenceIds = activeFlow?.sectionIds ?? hqManualSections.map((item) => item.id)
  const currentIndex = sequenceIds.findIndex((id) => id === section.id)
  const prevSectionId = currentIndex > 0 ? sequenceIds[currentIndex - 1] : null
  const nextSectionId = currentIndex >= 0 && currentIndex < sequenceIds.length - 1 ? sequenceIds[currentIndex + 1] : null
  const flowQuery = activeFlow ? `?flow=${activeFlow.id}` : ''
  const prevHref = prevSectionId ? `/hq/manual/${prevSectionId}${flowQuery}` : null
  const nextHref = nextSectionId ? `/hq/manual/${nextSectionId}${flowQuery}` : null

  return (
    <section className="space-y-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-4 lg:space-y-0">
      <aside className="space-y-3">
        <details className="rounded-lg border bg-white p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">フロー目次</summary>
          <div className="mt-2 space-y-2">
            {hqWorkflows.map((flow) => (
              <details
                key={flow.id}
                open={activeFlow?.id === flow.id}
                className={`rounded border p-2 ${activeFlow?.id === flow.id ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                <summary className="cursor-pointer text-xs font-semibold text-gray-900">{flow.title}</summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {flow.sectionIds.map((id) => {
                    const item = getHqSection(id)
                    if (!item) return null
                    const isActive = item.id === section.id
                    return (
                      <Link
                        key={`${flow.id}-${id}`}
                        href={`/hq/manual/${id}?flow=${flow.id}`}
                        className={`rounded px-2 py-1 text-xs ${
                          isActive ? 'bg-blue-600 text-white' : 'border border-gray-300 text-blue-700'
                        }`}
                      >
                        {item.title}
                      </Link>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        </details>

        <div className="hidden rounded-lg border bg-white p-3 lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">フロー目次</h2>
          <div className="space-y-2">
            {hqWorkflows.map((flow) => (
              <details
                key={flow.id}
                open={activeFlow?.id === flow.id}
                className={`rounded border p-2 ${activeFlow?.id === flow.id ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                <summary className="cursor-pointer text-xs font-semibold text-gray-900">{flow.title}</summary>
                <div className="mt-2 space-y-1">
                  {flow.sectionIds.map((id) => {
                    const item = getHqSection(id)
                    if (!item) return null
                    const isActive = item.id === section.id
                    return (
                      <Link
                        key={`${flow.id}-${id}`}
                        href={`/hq/manual/${id}?flow=${flow.id}`}
                        className={`block rounded px-2 py-1 text-xs ${
                          isActive ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
                        }`}
                      >
                        {item.title}
                      </Link>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        <header className="rounded-lg border bg-white p-5">
          <h1 className="text-2xl font-semibold text-gray-900">{section.title}</h1>
          <div className="mb-3 mt-2">
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{section.path}</span>
          </div>
          <p className="text-sm text-gray-700">{section.purpose}</p>
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
          <h2 className="mb-2 text-sm font-semibold text-gray-900">タブ・カード別の見方</h2>
          <p className="mb-2 text-sm text-gray-700">{insight.pageGoal}</p>
          <div className="mb-4 space-y-3">
            {insight.tabs.map((tab) => (
              <article key={`${section.id}-tab-${tab.tab}`} className="rounded border p-3">
                <h3 className="text-sm font-semibold text-gray-900">タブ: {tab.tab}</h3>
                <p className="mt-1 text-xs text-gray-500">見るタイミング: {tab.when}</p>
                <p className="mt-1 text-sm text-gray-700">{tab.goal}</p>
                <dl className="mt-2 space-y-2">
                  {tab.cards.map((card) => (
                    <div key={`${section.id}-card-${tab.tab}-${card.card}`} className="rounded border bg-gray-50 p-2">
                      <dt className="text-sm font-semibold text-gray-900">{card.card}</dt>
                      <dd className="mt-1 text-sm text-gray-700">見る項目: {card.focus}</dd>
                      <dd className="mt-1 text-sm text-gray-700">使い方: {card.usage}</dd>
                      <dd className="mt-1 text-sm text-gray-700">判断: {card.decision}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <h2 className="mb-2 text-sm font-semibold text-gray-900">利用フロー</h2>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {guide.flow.map((item, index) => (
              <li key={`${section.id}-flow-${index}`}>{item}</li>
            ))}
          </ul>

          <h2 className="mb-2 text-sm font-semibold text-gray-900">項目詳細</h2>
          {guide.itemDetails.length > 0 ? (
            <dl className="mb-4 space-y-2 text-sm text-gray-700">
              {guide.itemDetails.map((item, index) => (
                <div key={`${section.id}-item-${index}`} className="rounded border p-2">
                  <dt className="font-semibold text-gray-900">{item.item}</dt>
                  <dd className="mt-1">{item.detail}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mb-4 text-sm text-gray-600">このページの項目詳細は未登録です。</p>
          )}

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

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            {prevHref ? (
              <Link href={prevHref} className="rounded border px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
                前へ
              </Link>
            ) : (
              <span className="rounded border px-3 py-2 text-sm text-gray-400">前へ</span>
            )}
            {nextHref ? (
              <Link href={nextHref} className="rounded border px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
                次へ
              </Link>
            ) : (
              <span className="rounded border px-3 py-2 text-sm text-gray-400">次へ</span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          用語の確認が必要な場合は
          <Link href="/hq/manual/glossary" className="ml-1 text-blue-700 hover:underline">
            用語集ページ
          </Link>
          を開いてください。
        </p>
      </div>
    </section>
  )
}
