import { notFound } from 'next/navigation'
import { ManualSectionPage } from '@/components/manual/ManualPages'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { devManualMeta, devManualSections, devWorkflows, getDevSection, getDevSectionGuide, getDevSectionInsight } from '../manual-data'

type DevManualSectionPageProps = {
  params: Promise<{
    sectionId: string
  }>
  searchParams?: Promise<{
    flow?: string
  }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevManualSectionPage({ params, searchParams }: DevManualSectionPageProps) {
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

  const { sectionId } = await params
  const resolvedSearchParams = await searchParams
  const section = getDevSection(sectionId)
  if (!section) notFound()

  const guide = getDevSectionGuide(sectionId)
  const insight = getDevSectionInsight(sectionId, section)
  const requestedFlowId = resolvedSearchParams?.flow
  const flowByQuery = devWorkflows.find((flow) => flow.id === requestedFlowId && flow.sectionIds.includes(section.id))
  const flowByContain = devWorkflows.find((flow) => flow.sectionIds.includes(section.id))
  const activeFlow = flowByQuery ?? flowByContain ?? null

  return (
    <ManualSectionPage
      meta={devManualMeta}
      section={section}
      workflows={devWorkflows}
      sections={devManualSections}
      guide={guide}
      insight={insight}
      indexHref="/dev/manual"
      glossaryHref="/dev/manual/glossary"
      pathPrefix="/dev/manual"
      activeFlowId={activeFlow?.id ?? null}
    />
  )
}
