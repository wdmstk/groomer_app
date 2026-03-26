import { ConsentManagementPanel } from '@/components/consents/ConsentManagementPanel'
import { consentsPageFixtures } from '@/lib/e2e/consents-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    customer_id?: string
    pet_id?: string
  }>
}

export default async function ConsentsPage({ searchParams }: PageProps) {
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: consentsPageFixtures.storeId }
    : await createStoreScopedClient()
  const resolvedSearchParams = await searchParams
  const customerId = resolvedSearchParams?.customer_id
  const petId = resolvedSearchParams?.pet_id

  const [{ data: templates }, { data: customers }, { data: pets }, documentsQuery] = isPlaywrightE2E
    ? [
        { data: consentsPageFixtures.templates },
        { data: consentsPageFixtures.customers },
        { data: consentsPageFixtures.pets },
        {
          data: consentsPageFixtures.documents.filter((row) => {
            if (customerId && row.customer_id !== customerId) return false
            if (petId && row.pet_id !== petId) return false
            return true
          }),
        },
      ]
    : await Promise.all([
        supabase
          .from('consent_templates' as never)
          .select('id, name, category, status, current_version_id')
          .eq('store_id', storeId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pets')
          .select('id, customer_id, name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false }),
        (() => {
          let query = supabase
            .from('consent_documents' as never)
            .select('id, customer_id, pet_id, status, signed_at, created_at')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
          if (customerId) query = query.eq('customer_id', customerId)
          if (petId) query = query.eq('pet_id', petId)
          return query
        })(),
      ])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">電子同意書管理</h1>
        <p className="text-sm text-gray-600">同意書テンプレート管理、署名依頼、履歴確認を行います。</p>
      </div>
      <ConsentManagementPanel
        templates={(templates as Array<{ id: string; name: string; category: string; status: string; current_version_id: string | null }>) ?? []}
        documents={(documentsQuery.data as Array<{ id: string; customer_id: string; pet_id: string; status: string; signed_at: string | null; created_at: string }>) ?? []}
        customers={((customers ?? []) as Array<{ id: string; full_name: string }>).map((row) => ({ id: row.id, label: row.full_name }))}
        pets={((pets ?? []) as Array<{ id: string; customer_id: string; name: string }>).map((row) => ({
          id: row.id,
          customer_id: row.customer_id,
          label: row.name,
        }))}
      />
    </section>
  )
}
