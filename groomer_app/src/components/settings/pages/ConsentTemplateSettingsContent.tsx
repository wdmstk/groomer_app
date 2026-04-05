import { ConsentManagementPanel } from '@/components/consents/ConsentManagementPanel'
import { consentsPageFixtures } from '@/lib/e2e/consents-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConsentTemplateSettingsContent() {
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: consentsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>

  const [{ data: templates }, { data: store }] = isPlaywrightE2E
    ? [
        { data: consentsPageFixtures.templates },
        { data: { name: 'テスト店舗' } },
      ]
    : await Promise.all([
        db
          .from('consent_templates' as never)
          .select(
            'id, name, category, status, current_version_id, current_version:consent_template_versions!consent_templates_current_version_id_fkey(id, title, body_html, body_text, version_no)'
          )
          .eq('store_id', storeId)
          .order('updated_at', { ascending: false }),
        db.from('stores').select('name').eq('id', storeId).maybeSingle(),
      ])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">電子同意書テンプレ管理</h1>
        <p className="text-sm text-gray-600">
          店舗向けの同意書テンプレート作成と同意文の有効化を行います。
        </p>
      </div>
      <ConsentManagementPanel
        templates={
          ((templates as Array<{
            id: string
            name: string
            category: string
            status: string
            current_version_id: string | null
            current_version?: {
              id: string
              title: string
              body_html: string
              body_text: string
              version_no: number
            } | null
          }>) ?? [])
        }
        documents={[]}
        storeName={String((store as { name?: string | null } | null)?.name ?? '')}
        customers={[]}
        pets={[]}
        initialMode="store-admin"
      />
    </section>
  )
}
