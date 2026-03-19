import { ManualIndexPage } from '@/components/manual/ManualPages'
import { ManualViewModeSwitch } from '@/components/manual/ManualViewModeSwitch'
import { manualMeta, manualSections, workflows } from './manual-data'

export default function ManualPage() {
  return (
    <ManualIndexPage
      title="ユーザーマニュアル目次"
      meta={manualMeta}
      workflows={workflows}
      sections={manualSections}
      sectionBaseHref="/manual"
      glossaryHref="/manual/glossary"
      glossaryDescription="横文字やステータス、システム用語の説明をまとめて確認できます。"
      extraHeaderContent={<ManualViewModeSwitch />}
    />
  )
}
