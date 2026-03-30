import { ConsentManagementPanel } from '@/components/consents/ConsentManagementPanel'
import {
  formatConsentDateJst,
  formatPetAgeFromDateOfBirth,
  renderConsentTemplateHtml,
} from '@/lib/consents/template-render'
import { consentsPageFixtures } from '@/lib/e2e/consents-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    appointment_id?: string
    customer_id?: string
    pet_id?: string
    service_name?: string
  }>
}

export default async function ConsentsPage({ searchParams }: PageProps) {
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: consentsPageFixtures.storeId }
    : await createStoreScopedClient()
  const resolvedSearchParams = await searchParams
  const appointmentId = resolvedSearchParams?.appointment_id
  const customerId = resolvedSearchParams?.customer_id
  const petId = resolvedSearchParams?.pet_id
  const serviceName = resolvedSearchParams?.service_name

  const [{ data: templates }, { data: customers }, { data: pets }, documentsQuery, { data: store }, appointmentQuery] = isPlaywrightE2E
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
        { data: { name: 'テスト店舗' } },
        { data: null },
      ]
    : await Promise.all([
        supabase
          .from('consent_templates' as never)
          .select(
            'id, name, category, status, current_version_id, current_version:consent_template_versions!consent_templates_current_version_id_fkey(id, title, body_html, body_text, version_no)'
          )
          .eq('store_id', storeId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, full_name, address, phone_number')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pets')
          .select('id, customer_id, name, breed, gender, date_of_birth')
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
        supabase.from('stores').select('name').eq('id', storeId).maybeSingle(),
        appointmentId
          ? supabase
              .from('appointments')
              .select('id, customer_id, pet_id, menu')
              .eq('store_id', storeId)
              .eq('id', appointmentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

  const appointment = appointmentQuery?.data as
    | {
        id: string
        customer_id: string
        pet_id: string
        menu: string
      }
    | null

  const resolvedInitialCustomerId =
    appointment?.customer_id ??
    customerId ??
    (((pets as Array<{ id: string; customer_id: string }> | null) ?? []).find((row) => row.id === petId)?.customer_id ?? '')
  const resolvedInitialPetId = appointment?.pet_id ?? petId ?? ''
  const resolvedInitialServiceName = serviceName ?? appointment?.menu ?? ''

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">電子同意書管理</h1>
        <p className="text-sm text-gray-600">同意書テンプレート管理、署名依頼、履歴確認を行います。</p>
      </div>
      <ConsentManagementPanel
        templates={((templates as Array<{
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
        }>) ?? []).map((template) => ({
          ...template,
          current_version: template.current_version
            ? {
                ...template.current_version,
                body_html: renderConsentTemplateHtml(template.current_version.body_html, {
                  store_name: String((store as { name?: string | null } | null)?.name ?? ''),
                  consent_date: formatConsentDateJst(),
                }),
              }
            : null,
        }))}
        documents={(documentsQuery.data as Array<{ id: string; customer_id: string; pet_id: string; status: string; signed_at: string | null; created_at: string }>) ?? []}
        storeName={String((store as { name?: string | null } | null)?.name ?? '')}
        customers={((customers ?? []) as Array<{
          id: string
          full_name: string
          address: string | null
          phone_number: string | null
        }>).map((row) => ({
          id: row.id,
          label: row.full_name,
          address: row.address,
          phone_number: row.phone_number,
        }))}
        pets={((pets ?? []) as Array<{
          id: string
          customer_id: string
          name: string
          breed: string | null
          gender: string | null
          date_of_birth: string | null
        }>).map((row) => ({
          id: row.id,
          customer_id: row.customer_id,
          label: row.name,
          breed: row.breed,
          gender: row.gender,
          age: formatPetAgeFromDateOfBirth(row.date_of_birth),
        }))}
        initialAppointmentId={appointment?.id ?? appointmentId ?? ''}
        initialDocCustomerId={resolvedInitialCustomerId}
        initialDocPetId={resolvedInitialPetId}
        initialServiceName={resolvedInitialServiceName}
      />
    </section>
  )
}
