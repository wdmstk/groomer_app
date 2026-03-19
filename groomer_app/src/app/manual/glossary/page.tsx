import { ManualGlossaryPage } from '@/components/manual/ManualPages'
import { manualGlossary, manualMeta } from '../manual-data'

export default function ManualGlossaryPageRoute() {
  return <ManualGlossaryPage title="用語集（横文字・ステータスの説明）" meta={manualMeta} glossary={manualGlossary} indexHref="/manual" />
}
