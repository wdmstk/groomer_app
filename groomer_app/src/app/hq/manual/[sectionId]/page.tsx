import { notFound } from 'next/navigation'
import { ManualSectionPage } from '@/components/manual/ManualPages'
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

  return (
    <ManualSectionPage
      meta={hqManualMeta}
      section={section}
      workflows={hqWorkflows}
      sections={hqManualSections}
      guide={guide}
      insight={insight}
      indexHref="/hq/manual"
      glossaryHref="/hq/manual/glossary"
      pathPrefix="/hq/manual"
      activeFlowId={activeFlow?.id ?? null}
    />
  )
}
