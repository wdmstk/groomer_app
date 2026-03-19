import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ManualSectionPage } from '@/components/manual/ManualPages'
import { getSection, getSectionGuide, getSectionInsight, manualMeta, manualSections, workflows } from '../manual-data'

type ManualSectionPageProps = {
  params: Promise<{
    sectionId: string
  }>
  searchParams?: Promise<{
    flow?: string
  }>
}

export default async function ManualSectionPageRoute({ params, searchParams }: ManualSectionPageProps) {
  const { sectionId } = await params
  const resolvedSearchParams = await searchParams
  const section = getSection(sectionId)

  if (!section) {
    notFound()
  }

  const guide = getSectionGuide(sectionId)
  const insight = getSectionInsight(sectionId, section)
  const cookieStore = await cookies()
  const viewMode = cookieStore.get('manual_view_mode')?.value === 'admin' ? 'admin' : 'staff'
  const requestedFlowId = resolvedSearchParams?.flow
  const flowByQuery = workflows.find((flow) => flow.id === requestedFlowId && flow.sectionIds.includes(section.id))
  const flowByContain = workflows.find((flow) => flow.sectionIds.includes(section.id))
  const activeFlow = flowByQuery ?? flowByContain ?? null

  return (
    <ManualSectionPage
      meta={manualMeta}
      section={section}
      workflows={workflows}
      sections={manualSections}
      guide={guide}
      insight={insight}
      indexHref="/manual"
      glossaryHref="/manual/glossary"
      pathPrefix="/manual"
      activeFlowId={activeFlow?.id ?? null}
      viewMode={viewMode}
      viewLabel={viewMode === 'admin' ? '管理者向け詳細版' : 'スタッフ向け簡易版'}
    />
  )
}
