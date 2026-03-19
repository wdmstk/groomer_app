import type { ReactNode } from 'react'
import Link from 'next/link'

export type ManualMetaLike = {
  updatedAt: string
  targetVersion: string
}

export type ManualSectionLike = {
  id: string
  title: string
  path: string
  purpose: string
  procedures: string[]
  cautions: string[]
}

export type ManualWorkflowLike = {
  id: string
  title: string
  goal: string
  sectionIds: string[]
}

export type ManualGlossaryTermLike = {
  term: string
  meaning: string
}

export type ManualItemDetailLike = {
  item: string
  detail: string
}

export type ManualSectionGuideLike = {
  flow: string[]
  itemDetails: ManualItemDetailLike[]
}

export type ManualCardGuideLike = {
  card: string
  focus: string
  usage: string
  decision: string
}

export type ManualTabGuideLike = {
  tab: string
  when: string
  goal: string
  cards: ManualCardGuideLike[]
}

export type ManualSectionInsightLike = {
  pageGoal: string
  tabs: ManualTabGuideLike[]
}

type IndexPageProps = {
  title: string
  meta: ManualMetaLike
  workflows: ManualWorkflowLike[]
  sections: ManualSectionLike[]
  sectionBaseHref: string
  glossaryHref: string
  glossaryTitle?: string
  glossaryDescription: string
  extraHeaderContent?: ReactNode
}

type GlossaryPageProps = {
  title: string
  meta: ManualMetaLike
  glossary: ManualGlossaryTermLike[]
  indexHref: string
}

type SectionPageProps = {
  meta: ManualMetaLike
  section: ManualSectionLike
  workflows: ManualWorkflowLike[]
  sections: ManualSectionLike[]
  guide: ManualSectionGuideLike
  insight: ManualSectionInsightLike
  indexHref: string
  glossaryHref: string
  pathPrefix: string
  activeFlowId?: string | null
  viewMode?: 'staff' | 'admin'
  viewLabel?: string
}

function buildSectionMap(sections: ManualSectionLike[]) {
  return new Map(sections.map((section) => [section.id, section]))
}

function buildFlowLinks(props: {
  workflows: ManualWorkflowLike[]
  sections: ManualSectionLike[]
  activeSectionId: string
  pathPrefix: string
  activeFlowId?: string | null
}) {
  const sectionMap = buildSectionMap(props.sections)

  return props.workflows.map((flow) => ({
    ...flow,
    active: flow.id === props.activeFlowId,
    links: flow.sectionIds
      .map((id) => sectionMap.get(id))
      .filter((section): section is ManualSectionLike => Boolean(section))
      .map((section) => ({
        ...section,
        href: `${props.pathPrefix}/${section.id}?flow=${flow.id}`,
        active: section.id === props.activeSectionId,
      })),
  }))
}

export function ManualIndexPage({
  title,
  meta,
  workflows,
  sections,
  sectionBaseHref,
  glossaryHref,
  glossaryTitle = '用語集',
  glossaryDescription,
  extraHeaderContent,
}: IndexPageProps) {
  const sectionMap = buildSectionMap(sections)

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {extraHeaderContent}
        </div>
        <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
          更新日: {meta.updatedAt} / 対象バージョン: {meta.targetVersion}
        </div>
      </header>

      <div className="space-y-3">
        {workflows.map((workflow) => (
          <article key={workflow.id} className="rounded border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{workflow.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{workflow.goal}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workflow.sectionIds.map((sectionId) => {
                const section = sectionMap.get(sectionId)
                if (!section) return null
                return (
                  <Link
                    key={`${workflow.id}-${section.id}`}
                    href={`${sectionBaseHref}/${section.id}?flow=${workflow.id}`}
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
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{glossaryTitle}</h2>
        <p className="mb-3 text-sm text-gray-600">{glossaryDescription}</p>
        <Link
          href={glossaryHref}
          className="inline-flex rounded border px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50"
        >
          用語集ページを開く
        </Link>
      </div>
    </section>
  )
}

export function ManualGlossaryPage({ title, meta, glossary, indexHref }: GlossaryPageProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-xs text-gray-500">
          更新日: {meta.updatedAt} / 対象バージョン: {meta.targetVersion}
        </p>
        <div className="mt-4">
          <Link href={indexHref} className="text-sm text-blue-700 hover:underline">
            目次に戻る
          </Link>
        </div>
      </header>

      <article className="rounded-lg border bg-white p-5">
        <dl className="space-y-2 text-sm text-gray-700">
          {glossary.map((item) => (
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

export function ManualSectionPage({
  meta,
  section,
  workflows,
  sections,
  guide,
  insight,
  indexHref,
  glossaryHref,
  pathPrefix,
  activeFlowId,
  viewMode = 'admin',
  viewLabel,
}: SectionPageProps) {
  const flowLinks = buildFlowLinks({
    workflows,
    sections,
    activeSectionId: section.id,
    pathPrefix,
    activeFlowId,
  })
  const activeFlow = workflows.find((flow) => flow.id === activeFlowId) ?? null
  const sequenceIds = activeFlow?.sectionIds ?? sections.map((item) => item.id)
  const currentIndex = sequenceIds.findIndex((id) => id === section.id)
  const prevSectionId = currentIndex > 0 ? sequenceIds[currentIndex - 1] : null
  const nextSectionId = currentIndex >= 0 && currentIndex < sequenceIds.length - 1 ? sequenceIds[currentIndex + 1] : null
  const flowQuery = activeFlow ? `?flow=${activeFlow.id}` : ''
  const prevHref = prevSectionId ? `${pathPrefix}/${prevSectionId}${flowQuery}` : null
  const nextHref = nextSectionId ? `${pathPrefix}/${nextSectionId}${flowQuery}` : null
  const isAdminView = viewMode === 'admin'
  const staffSteps = section.procedures.slice(0, 3)
  const staffCautions = section.cautions.slice(0, 2)

  return (
    <section className="space-y-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-4 lg:space-y-0">
      <aside className="space-y-3">
        <details className="rounded-lg border bg-white p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">フロー目次</summary>
          <div className="mt-2 space-y-2">
            {flowLinks.map((flow) => (
              <details
                key={flow.id}
                open={flow.active}
                className={`rounded border p-2 ${flow.active ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                <summary className="cursor-pointer text-xs font-semibold text-gray-900">{flow.title}</summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {flow.links.map((item) => (
                    <Link
                      key={`${flow.id}-${item.id}`}
                      href={item.href}
                      className={`rounded px-2 py-1 text-xs ${
                        item.active ? 'bg-blue-600 text-white' : 'border border-gray-300 text-blue-700'
                      }`}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>

        <div className="hidden rounded-lg border bg-white p-3 lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">フロー目次</h2>
          <div className="space-y-2">
            {flowLinks.map((flow) => (
              <details
                key={flow.id}
                open={flow.active}
                className={`rounded border p-2 ${flow.active ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                <summary className="cursor-pointer text-xs font-semibold text-gray-900">{flow.title}</summary>
                <div className="mt-2 space-y-1">
                  {flow.links.map((item) => (
                    <Link
                      key={`${flow.id}-${item.id}`}
                      href={item.href}
                      className={`block rounded px-2 py-1 text-xs ${
                        item.active ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        <header className="rounded-lg border bg-white p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">{section.title}</h1>
            {viewLabel ? (
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  isAdminView ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {viewLabel}
              </span>
            ) : null}
          </div>
          <div className="mb-3">
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{section.path}</span>
          </div>
          <p className="text-sm text-gray-700">{section.purpose}</p>
          <p className="mt-2 text-xs text-gray-500">
            更新日: {meta.updatedAt} / 対象バージョン: {meta.targetVersion}
          </p>
          <div className="mt-4">
            <Link href={indexHref} className="text-sm text-blue-700 hover:underline">
              目次に戻る
            </Link>
          </div>
        </header>

        <article className="rounded-lg border bg-white p-5">
          {!isAdminView && viewLabel ? (
            <>
              <h2 className="mb-2 text-sm font-semibold text-gray-900">タブ・カード別の見るポイント</h2>
              <div className="mb-4 space-y-2">
                {insight.tabs.map((tab) => (
                  <article key={`${section.id}-staff-tab-${tab.tab}`} className="rounded border p-3">
                    <p className="text-xs font-semibold text-gray-500">タブ: {tab.tab}</p>
                    <p className="mt-1 text-xs text-gray-500">見るタイミング: {tab.when}</p>
                    <p className="mt-1 text-sm text-gray-700">{tab.goal}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                      {tab.cards.map((card) => (
                        <li key={`${section.id}-staff-card-${tab.tab}-${card.card}`}>
                          <span className="font-semibold text-gray-900">{card.card}</span>: {card.focus} / {card.usage}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <h2 className="mb-2 text-sm font-semibold text-gray-900">最短手順</h2>
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                {staffSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>

              <h2 className="mb-2 text-sm font-semibold text-gray-900">最低限の注意点</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {staffCautions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
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
            </>
          )}
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
          <Link href={glossaryHref} className="ml-1 text-blue-700 hover:underline">
            用語集ページ
          </Link>
          を開いてください。
        </p>
      </div>
    </section>
  )
}
