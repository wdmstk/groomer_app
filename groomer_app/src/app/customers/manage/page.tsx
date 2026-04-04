import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CustomerCreateModal } from '@/components/customers/CustomerCreateModal'
import { CustomerMemberPortalControls } from '@/components/customers/CustomerMemberPortalControls'
import { PetCreateModal } from '@/components/pets/PetCreateModal'
import { JournalVisibilityToggleButton } from '@/components/journal/JournalVisibilityToggleButton'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { customersPageFixtures } from '@/lib/e2e/customers-page-fixtures'
import { petsPageFixtures } from '@/lib/e2e/pets-page-fixtures'
import {
  fetchCustomerLtvSummaries,
  getCustomerLtvRankLabel,
  getCustomerLtvRankTone,
  type CustomerLtvSummaryReader,
  type CustomerLtvSummaryRow,
} from '@/lib/customer-ltv'
import {
  formatCustomerFallback,
  formatCustomerNoShowCount,
  formatCustomerTags,
  getCustomerLineStatus,
} from '@/lib/customers/presentation'
import {
  formatPetFallback,
  formatPetList,
  formatPetWeight,
} from '@/lib/pets/presentation'
import {
  formatConsentDateTime,
  getConsentStatusLabel,
  getConsentStatusTone,
} from '@/lib/consents/presentation'
import { createSignedPhotoUrlMap } from '@/lib/medical-records/photos'
import { createSignedVideoUrlMap } from '@/lib/medical-records/videos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type RawSearchParams = Record<string, string | string[] | undefined>

type CustomersManagePageProps = {
  searchParams?: Promise<RawSearchParams>
}

type CustomerRow = {
  id: string
  full_name: string
  phone_number: string | null
  email: string | null
  address: string | null
  line_id: string | null
  how_to_know: string | null
  tags: string[] | null
}

type PetRow = {
  id: string
  name: string
  customer_id: string
  breed: string | null
  gender: string | null
  date_of_birth: string | null
  weight: number | null
  vaccine_date: string | null
  chronic_diseases: string[] | null
  notes: string | null
  customers?: { full_name: string } | { full_name: string }[] | null
}

type StaffRelation = { full_name: string | null } | { full_name: string | null }[] | null

type MedicalRecordRow = {
  id: string
  record_date: string | null
  menu: string | null
  status: 'draft' | 'finalized' | null
  tags: string[] | null
  staffs?: StaffRelation
}

type JournalEntryRow = {
  id: string
  status: string
  visibility: string
  posted_at: string | null
  created_at: string
  body_text: string | null
}

type JournalEntryPetRow = {
  entry_id: string
}

type JournalMediaRow = {
  entry_id: string
  media_type: 'photo' | 'video'
  storage_key: string
  thumbnail_key: string | null
  sort_order: number
}

type MemberPortalLink = {
  id: string
  customer_id: string
  expires_at: string
  last_used_at: string | null
}

type ConsentSummary = {
  id: string
  status: string
  created_at: string
  signed_at: string | null
}

type SettingsRow = {
  medical_record_list_limit: number | null
  journal_visibility_mode: string | null
}

type CustomerOption = {
  id: string
  full_name: string
}

type StaffOption = {
  id: string
  full_name: string
}

type ServiceMenuOption = {
  id: string
  name: string
  duration: number | null
}

type JournalPreviewMedia = {
  mediaType: 'photo' | 'video'
  signedUrl: string | null
}

type AppointmentVisitRow = {
  id: string
  start_time: string
  menu: string | null
  pets?: { name: string | null } | { name: string | null }[] | null
}

type HotelVisitRow = {
  id: string
  planned_check_in_at: string
  planned_check_out_at: string
  pets?: { name: string | null } | { name: string | null }[] | null
}

type VisitHistoryItem = {
  id: string
  kind: 'grooming' | 'hotel'
  date: string
  petName: string
  description: string
  actionHref: string
  actionLabel: string
}

const genderOptions = ['オス', 'メス', '不明']

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function toJstDateTime(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatCurrency(value: number | null | undefined) {
  return Math.round(value ?? 0).toLocaleString()
}

function getStaffName(relation: StaffRelation) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.full_name ?? '未登録'
  return relation.full_name ?? '未登録'
}

function getPetName(
  relation: { name: string | null } | { name: string | null }[] | null | undefined
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.name ?? '未登録'
  return relation.name ?? '未登録'
}

function formatHotelPeriod(checkInAt: string | null | undefined, checkOutAt: string | null | undefined) {
  return `${toJstDateTime(checkInAt)} 〜 ${toJstDateTime(checkOutAt)}`
}

function buildManageHref(params: {
  customerId?: string
  tab?: string
  q?: string
  customerEdit?: string
  petEdit?: string
  modal?: string
  waitlistCustomer?: string
}) {
  const search = new URLSearchParams()
  if (params.customerId) search.set('customer_id', params.customerId)
  if (params.tab) search.set('tab', params.tab)
  if (params.q) search.set('q', params.q)
  if (params.customerEdit) search.set('customer_edit', params.customerEdit)
  if (params.petEdit) search.set('pet_edit', params.petEdit)
  if (params.modal) search.set('modal', params.modal)
  if (params.waitlistCustomer) search.set('waitlist_customer', params.waitlistCustomer)
  const serialized = search.toString()
  return serialized ? `/customers/manage?${serialized}` : '/customers/manage'
}

function renderLineStatus(lineId: string | null) {
  const status = getCustomerLineStatus(lineId)
  if (status.linked) {
    return (
      <div className="space-y-1">
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          {status.badgeLabel}
        </span>
        <p className="text-xs text-gray-500">{status.detail}</p>
      </div>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
      {status.badgeLabel}
    </span>
  )
}

export default async function CustomersManagePage({ searchParams }: CustomersManagePageProps) {
  const params = (await searchParams) ?? {}
  const q = (firstParam(params.q) ?? '').trim()
  const rawCustomerId = firstParam(params.customer_id) ?? ''
  const rawTab = firstParam(params.tab) ?? 'basic'
  const customerEditId = firstParam(params.customer_edit) ?? ''
  const petEditId = firstParam(params.pet_edit) ?? ''
  const rawModal = firstParam(params.modal) ?? ''
  const rawWaitlistCustomerId = firstParam(params.waitlist_customer) ?? ''

  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: customersPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const adminSupabase = isPlaywrightE2E ? null : createAdminSupabaseClient()

  const settingsRow = isPlaywrightE2E
    ? ({ medical_record_list_limit: 10, journal_visibility_mode: 'published_only' } as SettingsRow)
    : (
        await db
          .from('store_customer_management_settings' as never)
          .select('medical_record_list_limit, journal_visibility_mode')
          .eq('store_id', storeId)
          .maybeSingle()
      ).data as SettingsRow | null
  const medicalRecordListLimit = Math.max(5, Math.min(100, Number(settingsRow?.medical_record_list_limit ?? 10)))
  const journalVisibilityMode =
    settingsRow?.journal_visibility_mode === 'include_drafts' ? 'include_drafts' : 'published_only'

  const customersData = isPlaywrightE2E
    ? customersPageFixtures.customers
    : (
        await db
          .from('customers')
          .select('id, full_name, phone_number, email, address, line_id, how_to_know, tags')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data
  const allCustomers = (customersData ?? []) as CustomerRow[]
  const customers = allCustomers.filter((customer) => {
    if (!q) return true
    const haystack = `${customer.full_name ?? ''} ${customer.phone_number ?? ''}`.toLowerCase()
    return haystack.includes(q.toLowerCase())
  })

  const selectedCustomer =
    customers.find((customer) => customer.id === rawCustomerId) ?? customers[0] ?? null
  const selectedCustomerId = selectedCustomer?.id ?? ''

  const petsData = isPlaywrightE2E
    ? petsPageFixtures.pets
    : (
        await db
          .from('pets')
          .select('id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes, customers(full_name)')
          .eq('store_id', storeId)
          .order('name', { ascending: true })
      ).data
  const allPets = (petsData ?? []) as PetRow[]
  const selectedCustomerPets = selectedCustomer
    ? allPets.filter((pet) => pet.customer_id === selectedCustomer.id)
    : []

  const activeTab = (() => {
    if (!selectedCustomer) return 'basic'
    if (rawTab.startsWith('pet:')) {
      const petId = rawTab.slice(4)
      const found = selectedCustomerPets.find((pet) => pet.id === petId)
      if (found) return `pet:${found.id}`
    }
    return 'basic'
  })()
  const activePetId = activeTab.startsWith('pet:') ? activeTab.slice(4) : ''
  const activePet = selectedCustomerPets.find((pet) => pet.id === activePetId) ?? null
  const isWaitlistModalOpen = rawModal === 'waitlist'
  const waitlistCustomer = isWaitlistModalOpen
    ? allCustomers.find((customer) => customer.id === rawWaitlistCustomerId) ??
      selectedCustomer ??
      null
    : null
  const waitlistPets =
    waitlistCustomer
      ? allPets.filter((pet) => pet.customer_id === waitlistCustomer.id)
      : []
  const waitlistSupportRows = isWaitlistModalOpen && !isPlaywrightE2E
    ? await Promise.all([
        db
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false }),
        db
          .from('service_menus')
          .select('id, name, duration')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ])
    : null
  const waitlistStaffs = isWaitlistModalOpen
    ? ((waitlistSupportRows?.[0].data ?? []) as StaffOption[])
    : []
  const waitlistServiceMenus = isWaitlistModalOpen
    ? ((waitlistSupportRows?.[1].data ?? []) as ServiceMenuOption[])
    : []

  const appointmentRows = isPlaywrightE2E
    ? customersPageFixtures.appointments
    : (
        await db
          .from('appointments')
          .select('customer_id')
          .eq('store_id', storeId)
          .eq('status', '無断キャンセル')
      ).data ?? []
  const noShowCounts = ((appointmentRows ?? []) as Array<{ customer_id: string | null }>).reduce(
    (acc, row) => {
      if (row.customer_id) acc[row.customer_id] = (acc[row.customer_id] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const customerLtvRows = isPlaywrightE2E
    ? []
    : await fetchCustomerLtvSummaries({
        supabase: db as unknown as CustomerLtvSummaryReader,
        storeId,
      })
  const customerLtvByCustomerId = new Map<string, CustomerLtvSummaryRow>()
  ;((customerLtvRows as CustomerLtvSummaryRow[] | null) ?? []).forEach((row) => {
    if (!row.customer_id || customerLtvByCustomerId.has(row.customer_id)) return
    customerLtvByCustomerId.set(row.customer_id, row)
  })

  const memberPortalRows =
    isPlaywrightE2E || !adminSupabase
      ? customersPageFixtures.memberPortalLinks
      : (
          await adminSupabase
            .from('member_portal_links')
            .select('id, customer_id, expires_at, last_used_at')
            .eq('store_id', storeId)
            .eq('purpose', 'member_portal')
            .is('revoked_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: false })
        ).data ?? []
  const activeMemberPortalByCustomerId = new Map<string, MemberPortalLink>()
  ;((memberPortalRows ?? []) as MemberPortalLink[]).forEach((row) => {
    if (!activeMemberPortalByCustomerId.has(row.customer_id)) {
      activeMemberPortalByCustomerId.set(row.customer_id, row)
    }
  })

  const medicalRecordsData =
    activePet && !isPlaywrightE2E
      ? (
          await db
            .from('medical_records')
            .select('id, record_date, menu, status, tags, staffs(full_name)')
            .eq('store_id', storeId)
            .eq('pet_id', activePet.id)
            .order('record_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(medicalRecordListLimit)
        ).data
      : []
  const medicalRecords = (medicalRecordsData ?? []) as MedicalRecordRow[]

  const journalEntryMappingsData =
    activePet && !isPlaywrightE2E
      ? (
          await db
            .from('journal_entry_pets')
            .select('entry_id')
            .eq('store_id', storeId)
            .eq('pet_id', activePet.id)
        ).data
      : []
  const journalEntryIds = ((journalEntryMappingsData ?? []) as JournalEntryPetRow[])
    .map((row) => String(row.entry_id))
    .filter(Boolean)

  let journalEntries: JournalEntryRow[] = []
  if (activePet && !isPlaywrightE2E && journalEntryIds.length > 0) {
    const baseQuery = db
      .from('journal_entries')
      .select('id, status, visibility, posted_at, created_at, body_text')
      .eq('store_id', storeId)
      .in('id', journalEntryIds)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20)

    const entriesResponse =
      journalVisibilityMode === 'published_only'
        ? await baseQuery.eq('status', 'published')
        : await baseQuery

    journalEntries = (entriesResponse.data ?? []) as JournalEntryRow[]
  }

  const journalMediaRowsData =
    activePet && !isPlaywrightE2E && journalEntries.length > 0
      ? (
          await db
            .from('journal_media')
            .select('entry_id, media_type, storage_key, thumbnail_key, sort_order')
            .eq('store_id', storeId)
            .in(
              'entry_id',
              journalEntries.map((entry) => entry.id)
            )
            .order('sort_order', { ascending: true })
        ).data
      : []
  const journalMediaCountByEntryId = new Map<string, number>()
  ;((journalMediaRowsData ?? []) as JournalMediaRow[]).forEach((row) => {
    const key = String(row.entry_id)
    journalMediaCountByEntryId.set(key, (journalMediaCountByEntryId.get(key) ?? 0) + 1)
  })
  const firstJournalMediaByEntryId = new Map<string, JournalMediaRow>()
  ;((journalMediaRowsData ?? []) as JournalMediaRow[]).forEach((row) => {
    const key = String(row.entry_id)
    if (!firstJournalMediaByEntryId.has(key)) {
      firstJournalMediaByEntryId.set(key, row)
    }
  })
  const firstJournalPhotoPaths = Array.from(firstJournalMediaByEntryId.values())
    .filter((row) => row.media_type === 'photo')
    .map((row) => row.storage_key)
  const firstJournalVideoPaths = Array.from(firstJournalMediaByEntryId.values())
    .filter((row) => row.media_type === 'video')
    .map((row) => row.thumbnail_key || row.storage_key)
  const [journalPhotoSignedUrlMap, journalVideoSignedUrlMap] = isPlaywrightE2E
    ? [new Map<string, string>(), new Map<string, string>()]
    : await Promise.all([
        createSignedPhotoUrlMap(db, firstJournalPhotoPaths, 60 * 30),
        createSignedVideoUrlMap(db, firstJournalVideoPaths, 60 * 30),
      ])
  const journalPreviewMediaByEntryId = new Map<string, JournalPreviewMedia>()
  ;((journalEntries ?? []) as JournalEntryRow[]).forEach((entry) => {
    const media = firstJournalMediaByEntryId.get(entry.id)
    if (!media) return
    if (media.media_type === 'photo') {
      journalPreviewMediaByEntryId.set(entry.id, {
        mediaType: 'photo',
        signedUrl: journalPhotoSignedUrlMap.get(media.storage_key) ?? null,
      })
      return
    }
    const previewPath = media.thumbnail_key || media.storage_key
    journalPreviewMediaByEntryId.set(entry.id, {
      mediaType: 'video',
      signedUrl: journalVideoSignedUrlMap.get(previewPath) ?? null,
    })
  })

  const customerOptions = (isPlaywrightE2E
    ? petsPageFixtures.customers
    : (
        await db
          .from('customers')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data ?? []) as CustomerOption[]

  const editCustomer =
    customerEditId && !isPlaywrightE2E
      ? (
          await db
            .from('customers')
            .select('id, full_name, phone_number, email, address, line_id, how_to_know, tags')
            .eq('id', customerEditId)
            .eq('store_id', storeId)
            .maybeSingle()
        ).data
      : customerEditId
      ? customers.find((customer) => customer.id === customerEditId) ?? null
      : null

  const editCustomerConsentsData =
    customerEditId && !isPlaywrightE2E
      ? (
          await db
            .from('consent_documents')
            .select('id, status, created_at, signed_at')
            .eq('store_id', storeId)
            .eq('customer_id', customerEditId)
            .order('created_at', { ascending: false })
            .limit(5)
        ).data
      : []
  const editCustomerConsents = (editCustomerConsentsData ?? []) as ConsentSummary[]

  const editPetData =
    petEditId && !isPlaywrightE2E
      ? (
          await db
            .from('pets')
            .select('id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
            .eq('id', petEditId)
            .eq('store_id', storeId)
            .maybeSingle()
        ).data
      : petEditId
      ? allPets.find((pet) => pet.id === petEditId) ?? null
      : null

  const editPetConsentsData =
    petEditId && !isPlaywrightE2E
      ? (
          await db
            .from('consent_documents')
            .select('id, status, created_at, signed_at')
            .eq('store_id', storeId)
            .eq('pet_id', petEditId)
            .order('created_at', { ascending: false })
            .limit(5)
        ).data
      : []
  const editPetConsents = (editPetConsentsData ?? []) as ConsentSummary[]

  const modalCloseHref = buildManageHref({
    customerId: selectedCustomerId || undefined,
    tab: activeTab,
    q: q || undefined,
  })
  const appointmentVisits = (
    selectedCustomer && !isPlaywrightE2E
      ? (
          await db
            .from('appointments')
            .select('id, start_time, menu, pets(name)')
            .eq('store_id', storeId)
            .eq('customer_id', selectedCustomer.id)
            .order('start_time', { ascending: false })
            .limit(30)
        ).data
      : []
  ) as AppointmentVisitRow[]
  const hotelVisits = (
    selectedCustomer && !isPlaywrightE2E && selectedCustomerPets.length > 0
      ? (
          await db
            .from('hotel_stays')
            .select('id, planned_check_in_at, planned_check_out_at, pets(name)')
            .eq('store_id', storeId)
            .in(
              'pet_id',
              selectedCustomerPets.map((pet) => pet.id)
            )
            .order('planned_check_in_at', { ascending: false })
            .limit(30)
        ).data
      : []
  ) as HotelVisitRow[]
  const visitHistoryItems: VisitHistoryItem[] = [
    ...appointmentVisits.map((visit) => ({
      id: `appt-${visit.id}`,
      kind: 'grooming' as const,
      date: visit.start_time,
      petName: getPetName(visit.pets),
      description: visit.menu?.trim() || '施術内容未登録',
      actionHref: `/appointments?tab=list&edit=${visit.id}`,
      actionLabel: '予約詳細',
    })),
    ...hotelVisits.map((visit) => ({
      id: `hotel-${visit.id}`,
      kind: 'hotel' as const,
      date: visit.planned_check_in_at,
      petName: getPetName(visit.pets),
      description: formatHotelPeriod(visit.planned_check_in_at, visit.planned_check_out_at),
      actionHref: `/hotel?stay_id=${visit.id}`,
      actionLabel: 'ホテル台帳',
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">顧客管理（β）</h1>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-gray-500">顧客選択</p>
          <details className="group relative">
            <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-600" aria-hidden="true">
                <path
                  d="M14.167 14.166 18.333 18.333M16.667 9.167A7.5 7.5 0 1 1 1.667 9.167a7.5 7.5 0 0 1 15 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {q ? `検索: ${q}` : '検索'}
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(92vw,26rem)] rounded border border-gray-200 bg-white p-3 shadow-lg">
              <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" method="get" action="/customers/manage">
                <Input name="q" defaultValue={q} placeholder="顧客名・電話番号で検索" />
                <Button type="submit">検索</Button>
                <Link
                  href="/customers/manage"
                  className="inline-flex h-9 items-center justify-center rounded border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  クリア
                </Link>
              </form>
            </div>
          </details>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {customers.length === 0 ? (
            <p className="py-1 text-sm text-gray-500">該当する顧客がいません。</p>
          ) : (
            customers.map((customer) => (
              <Link
                key={customer.id}
                href={buildManageHref({
                  customerId: customer.id,
                  tab: 'basic',
                  q: q || undefined,
                })}
                scroll={false}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                  selectedCustomer?.id === customer.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {customer.full_name}
              </Link>
            ))
          )}
        </div>
      </section>

      {!selectedCustomer ? (
        <Card>
          <p className="text-sm text-gray-600">検索から顧客を選択してください。</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-gray-900">{selectedCustomer.full_name}</p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getCustomerLtvRankTone(
                    customerLtvByCustomerId.get(selectedCustomer.id)?.ltv_rank
                  )}`}
                >
                  {getCustomerLtvRankLabel(customerLtvByCustomerId.get(selectedCustomer.id)?.ltv_rank)}
                </span>
                {formatCustomerNoShowCount(noShowCounts[selectedCustomer.id] ?? 0) ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {formatCustomerNoShowCount(noShowCounts[selectedCustomer.id] ?? 0)}
                  </span>
                ) : null}
              </div>
              <div className="grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-300 bg-white text-xs sm:inline-flex sm:w-auto sm:text-sm">
                <Link
                  href={buildManageHref({
                    customerId: selectedCustomer.id,
                    tab: activeTab,
                    q: q || undefined,
                    customerEdit: selectedCustomer.id,
                  })}
                  scroll={false}
                  className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap px-2 font-medium text-blue-700 hover:bg-blue-50 sm:w-auto sm:px-3"
                >
                  <span className="sm:hidden">編集</span>
                  <span className="hidden sm:inline">顧客編集</span>
                </Link>
                <Link
                  href={buildManageHref({
                    customerId: selectedCustomer.id,
                    tab: activeTab,
                    q: q || undefined,
                    modal: 'waitlist',
                    waitlistCustomer: selectedCustomer.id,
                  })}
                  className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap border-l border-gray-300 px-2 font-medium text-emerald-700 hover:bg-emerald-50 sm:w-auto sm:px-3"
                >
                  <span className="sm:hidden">待ち</span>
                  <span className="hidden sm:inline">空き枠待ち</span>
                </Link>
                <form action={`/api/customers/${selectedCustomer.id}`} method="post" className="border-l border-gray-300">
                  <input type="hidden" name="_method" value="delete" />
                  <button
                    type="submit"
                    className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap px-2 font-medium text-red-700 hover:bg-red-50 sm:w-auto sm:px-3"
                  >
                    <span className="sm:hidden">削除</span>
                    <span className="hidden sm:inline">顧客削除</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={buildManageHref({
                    customerId: selectedCustomer.id,
                    tab: 'basic',
                    q: q || undefined,
                  })}
                  scroll={false}
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${
                    activeTab === 'basic' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  基本情報
                </Link>
                {selectedCustomerPets.map((pet) => (
                  <Link
                    key={pet.id}
                    href={buildManageHref({
                      customerId: selectedCustomer.id,
                      tab: `pet:${pet.id}`,
                      q: q || undefined,
                    })}
                    scroll={false}
                    className={`rounded px-3 py-1.5 text-sm font-semibold ${
                      activeTab === `pet:${pet.id}`
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pet.name}
                  </Link>
                ))}
              </div>
              {activePet ? (
                <div className="grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-300 bg-white text-xs sm:inline-flex sm:w-auto sm:text-sm">
                  <Link
                    href={buildManageHref({
                      customerId: selectedCustomer.id,
                      tab: activeTab,
                      q: q || undefined,
                      petEdit: activePet.id,
                    })}
                    scroll={false}
                    className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap px-2 font-medium text-blue-700 hover:bg-blue-50 sm:w-auto sm:px-3"
                  >
                    <span className="sm:hidden">編集</span>
                    <span className="hidden sm:inline">ペット編集</span>
                  </Link>
                  <Link
                    href={`/journal/pets/${activePet.id}`}
                    className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap border-l border-gray-300 px-2 font-medium text-emerald-700 hover:bg-emerald-50 sm:w-auto sm:px-3"
                  >
                    <span className="sm:hidden">日誌</span>
                    <span className="hidden sm:inline">日誌アルバム</span>
                  </Link>
                  <form action={`/api/pets/${activePet.id}`} method="post" className="border-l border-gray-300">
                    <input type="hidden" name="_method" value="delete" />
                    <button
                      type="submit"
                      className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap px-2 font-medium text-red-700 hover:bg-red-50 sm:w-auto sm:px-3"
                    >
                      <span className="sm:hidden">削除</span>
                      <span className="hidden sm:inline">ペット削除</span>
                    </button>
                  </form>
                </div>
              ) : null}
            </div>

            {activeTab === 'basic' ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">顧客情報</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">電話番号</dt>
                        <dd className="font-medium text-gray-900">
                          {formatCustomerFallback(selectedCustomer.phone_number)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">メール</dt>
                        <dd className="font-medium text-gray-900">
                          {formatCustomerFallback(selectedCustomer.email)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">住所</dt>
                        <dd className="font-medium text-gray-900">
                          {formatCustomerFallback(selectedCustomer.address)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">LINE</dt>
                        <dd className="font-medium text-gray-900">{renderLineStatus(selectedCustomer.line_id)}</dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">来店経路</dt>
                        <dd className="font-medium text-gray-900">
                          {formatCustomerFallback(selectedCustomer.how_to_know)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">タグ</dt>
                        <dd className="font-medium text-gray-900">{formatCustomerTags(selectedCustomer.tags)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-amber-900">会員証URL</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-amber-800">有効期限</dt>
                        <dd className="font-medium text-amber-900">
                          {toJstDateTime(activeMemberPortalByCustomerId.get(selectedCustomer.id)?.expires_at ?? null)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-amber-800">最終アクセス</dt>
                        <dd className="font-medium text-amber-900">
                          {toJstDateTime(activeMemberPortalByCustomerId.get(selectedCustomer.id)?.last_used_at ?? null)}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
                        <dt className="text-amber-800">運用ルール</dt>
                        <dd className="font-medium text-amber-900">発行から90日固定（アクセスで延長なし）</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <CustomerMemberPortalControls
                        customerId={selectedCustomer.id}
                        customerName={selectedCustomer.full_name}
                        activeExpiresAt={activeMemberPortalByCustomerId.get(selectedCustomer.id)?.expires_at ?? null}
                        lastUsedAt={activeMemberPortalByCustomerId.get(selectedCustomer.id)?.last_used_at ?? null}
                        compact
                      />
                    </div>
                  </section>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">年間売上</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(customerLtvByCustomerId.get(selectedCustomer.id)?.annual_sales)}円
                    </p>
                  </article>
                  <article className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">来店回数</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {customerLtvByCustomerId.get(selectedCustomer.id)?.visit_count ?? 0}回
                    </p>
                  </article>
                  <article className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">平均単価</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(customerLtvByCustomerId.get(selectedCustomer.id)?.average_spend)}円
                    </p>
                  </article>
                  <article className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">オプション利用率</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {customerLtvByCustomerId.get(selectedCustomer.id)?.option_usage_rate ?? 0}%
                    </p>
                  </article>
                </div>

                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">来店履歴</h3>
                    <p className="text-xs text-gray-500">最新30件</p>
                  </div>
                  {visitHistoryItems.length === 0 ? (
                    <p className="text-sm text-gray-500">来店履歴はまだありません。</p>
                  ) : (
                    <div className="space-y-2">
                      {visitHistoryItems.map((item) => (
                        <article
                          key={item.id}
                          className="grid gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 md:grid-cols-[11rem_8rem_1fr_auto]"
                        >
                          <p className="text-sm font-semibold text-gray-900">{toJstDateTime(item.date)}</p>
                          <p>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.kind === 'hotel'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-violet-100 text-violet-800'
                              }`}
                            >
                              {item.kind === 'hotel' ? 'ホテル利用' : '施術'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-gray-900">{item.petName}</span>
                            {' / '}
                            {item.description}
                          </p>
                          <p className="text-right">
                            <Link href={item.actionHref} className="text-xs font-semibold text-blue-700 hover:underline">
                              {item.actionLabel}
                            </Link>
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : activePet ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">ペット情報</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">犬種</dt>
                        <dd className="font-medium text-gray-900">{formatPetFallback(activePet.breed)}</dd>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">性別</dt>
                        <dd className="font-medium text-gray-900">{formatPetFallback(activePet.gender)}</dd>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">生年月日</dt>
                        <dd className="font-medium text-gray-900">{formatPetFallback(activePet.date_of_birth)}</dd>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">体重</dt>
                        <dd className="font-medium text-gray-900">{formatPetWeight(activePet.weight)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">健康・注意事項</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">ワクチン</dt>
                        <dd className="font-medium text-gray-900">{formatPetFallback(activePet.vaccine_date)}</dd>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">持病</dt>
                        <dd className="font-medium text-gray-900">{formatPetList(activePet.chronic_diseases)}</dd>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                        <dt className="text-gray-500">注意事項</dt>
                        <dd className="font-medium text-gray-900">{formatPetFallback(activePet.notes)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <Card>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">カルテ一覧</h3>
                    <p className="text-xs text-gray-500">表示件数: 最新 {medicalRecordListLimit} 件</p>
                  </div>
                  {medicalRecords.length === 0 ? (
                    <p className="text-sm text-gray-500">カルテはまだありません。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-left">
                        <thead className="border-b text-gray-500">
                          <tr>
                            <th className="px-2 py-2">記録日</th>
                            <th className="px-2 py-2">メニュー</th>
                            <th className="px-2 py-2">担当</th>
                            <th className="px-2 py-2">ステータス</th>
                            <th className="px-2 py-2">タグ</th>
                            <th className="px-2 py-2">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {medicalRecords.map((record) => (
                            <tr key={record.id}>
                              <td className="px-2 py-2">{toJstDateTime(record.record_date)}</td>
                              <td className="px-2 py-2">{formatCustomerFallback(record.menu)}</td>
                              <td className="px-2 py-2">{getStaffName(record.staffs ?? null)}</td>
                              <td className="px-2 py-2">{record.status === 'finalized' ? '確定' : '下書き'}</td>
                              <td className="px-2 py-2">{record.tags?.join(', ') || 'なし'}</td>
                              <td className="px-2 py-2">
                                <Link
                                  href={`/medical-records?tab=list&edit=${record.id}`}
                                  className="text-sm text-blue-700"
                                >
                                  開く
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">日誌一覧</h3>
                    <p className="text-xs text-gray-500">表示条件: {journalVisibilityMode === 'include_drafts' ? '下書き含む' : '公開済みのみ'}</p>
                  </div>
                  {journalEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">日誌はまだありません。</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {journalEntries.map((entry) => (
                        <article key={entry.id} className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  {toJstDateTime(entry.posted_at ?? entry.created_at)}
                                </p>
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                    entry.status === 'published' && entry.visibility === 'owner'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {entry.status === 'published' && entry.visibility === 'owner' ? '公開' : '非公開'}
                                </span>
                              </div>
                              <JournalVisibilityToggleButton
                                entryId={entry.id}
                                isPublic={entry.status === 'published' && entry.visibility === 'owner'}
                              />
                            </div>

                            <div className="relative h-24 overflow-hidden rounded border border-gray-200 bg-gray-100 md:h-28">
                              {journalPreviewMediaByEntryId.get(entry.id)?.signedUrl ? (
                                journalPreviewMediaByEntryId.get(entry.id)?.mediaType === 'photo' ? (
                                  <Image
                                    src={journalPreviewMediaByEntryId.get(entry.id)?.signedUrl ?? ''}
                                    alt="日誌メディア"
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, (max-width: 1536px) 33vw, 25vw"
                                    className="object-cover"
                                  />
                                ) : (
                                  <video
                                    src={journalPreviewMediaByEntryId.get(entry.id)?.signedUrl ?? ''}
                                    className="h-full w-full object-cover"
                                    muted
                                    playsInline
                                  />
                                )
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-gray-500">
                                  メディアなし
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              メディア {journalMediaCountByEntryId.get(entry.id) ?? 0}件
                            </p>

                            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">
                              {entry.body_text || '（コメントなし）'}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <Card>
                <p className="text-sm text-gray-600">この顧客にはまだペットが登録されていません。</p>
                <p className="mt-1 text-sm text-gray-600">`ペット管理` から追加してください。</p>
              </Card>
            )}

          </Card>
        </>
      )}

      {editCustomer ? (
        <CustomerCreateModal title="顧客情報の更新" closeRedirectTo={modalCloseHref}>
          <form action={`/api/customers/${editCustomer.id}`} method="post" className="space-y-4">
            <input type="hidden" name="_method" value="put" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                氏名
                <Input name="full_name" required defaultValue={editCustomer.full_name} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                電話番号
                <Input name="phone_number" defaultValue={editCustomer.phone_number ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                メールアドレス
                <Input type="email" name="email" defaultValue={editCustomer.email ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                住所
                <Input name="address" defaultValue={editCustomer.address ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                LINE ID
                <Input name="line_id" defaultValue={editCustomer.line_id ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                来店経路
                <Input name="how_to_know" defaultValue={editCustomer.how_to_know ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                タグ (カンマ区切り)
                <Input name="tags" defaultValue={editCustomer.tags?.join(', ') ?? ''} />
              </label>
            </div>

            <div className="rounded border border-indigo-200 bg-indigo-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-indigo-900">電子同意書（最新5件）</p>
                <span className="text-xs text-indigo-700">同意書作成は予約管理から行ってください</span>
              </div>
              {editCustomerConsents.length === 0 ? (
                <p className="text-sm text-indigo-900/80">同意書はまだありません。</p>
              ) : (
                <ul className="space-y-2">
                  {editCustomerConsents.map((consent) => (
                    <li key={consent.id} className="rounded border border-indigo-100 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getConsentStatusTone(consent.status)}`}
                        >
                          {getConsentStatusLabel(consent.status)}
                        </span>
                        <span className="text-xs text-gray-500">作成: {formatConsentDateTime(consent.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">署名: {formatConsentDateTime(consent.signed_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">更新する</Button>
              <Link href={modalCloseHref} className="text-sm text-gray-500">
                編集をやめる
              </Link>
            </div>
          </form>
        </CustomerCreateModal>
      ) : null}

      {editPetData ? (
        <PetCreateModal title="ペット情報の更新" closeRedirectTo={modalCloseHref}>
          <form action={`/api/pets/${editPetData.id}`} method="post" className="space-y-4">
            <input type="hidden" name="_method" value="put" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                飼い主
                <select
                  name="customer_id"
                  required
                  defaultValue={editPetData.customer_id}
                  className="w-full rounded border p-2"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                ペット名
                <Input name="name" required defaultValue={editPetData.name} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                犬種
                <Input name="breed" defaultValue={editPetData.breed ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                性別
                <select name="gender" defaultValue={editPetData.gender ?? ''} className="w-full rounded border p-2">
                  <option value="">未選択</option>
                  {genderOptions.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                生年月日
                <Input type="date" name="date_of_birth" defaultValue={editPetData.date_of_birth ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                体重 (kg)
                <Input type="number" step="0.1" name="weight" defaultValue={editPetData.weight?.toString() ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                最終ワクチン接種日
                <Input type="date" name="vaccine_date" defaultValue={editPetData.vaccine_date ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                持病 (カンマ区切り)
                <Input
                  name="chronic_diseases"
                  defaultValue={editPetData.chronic_diseases?.join(', ') ?? ''}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                注意事項
                <Input name="notes" defaultValue={editPetData.notes ?? ''} />
              </label>
            </div>

            <div className="rounded border border-indigo-200 bg-indigo-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-indigo-900">電子同意書（最新5件）</p>
                <span className="text-xs text-indigo-700">同意書作成は予約管理から行ってください</span>
              </div>
              {editPetConsents.length === 0 ? (
                <p className="text-sm text-indigo-900/80">同意書はまだありません。</p>
              ) : (
                <ul className="space-y-2">
                  {editPetConsents.map((consent) => (
                    <li key={consent.id} className="rounded border border-indigo-100 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getConsentStatusTone(consent.status)}`}
                        >
                          {getConsentStatusLabel(consent.status)}
                        </span>
                        <span className="text-xs text-gray-500">作成: {formatConsentDateTime(consent.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">署名: {formatConsentDateTime(consent.signed_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">更新する</Button>
              <Link href={modalCloseHref} className="text-sm text-gray-500">
                編集をやめる
              </Link>
            </div>
          </form>
        </PetCreateModal>
      ) : null}

      {isWaitlistModalOpen && waitlistCustomer ? (
        <CustomerCreateModal title="キャンセル枠 waitlist 登録" closeRedirectTo={modalCloseHref}>
          <form action="/api/reoffers/waitlists" method="post" className="space-y-4">
            <input type="hidden" name="customer_id" value={waitlistCustomer.id} />
            <input type="hidden" name="redirect_to" value={modalCloseHref} />
            <div className="rounded border bg-sky-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{waitlistCustomer.full_name}</p>
              <p>
                電話: {waitlistCustomer.phone_number ?? '未登録'} / LINE: {waitlistCustomer.line_id ?? '未登録'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                ペット
                <select
                  name="pet_id"
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue={waitlistPets[0]?.id ?? ''}
                >
                  <option value="">未指定</option>
                  {waitlistPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望メニュー
                <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                  {waitlistServiceMenus.length === 0 ? (
                    <p className="text-xs text-gray-500">選択可能なメニューがありません。</p>
                  ) : (
                    waitlistServiceMenus.map((menu) => (
                      <label key={menu.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="preferred_menus" value={menu.name} />
                        <span>
                          {menu.name}
                          {typeof menu.duration === 'number' && menu.duration > 0 ? ` (${menu.duration}分)` : ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望担当
                <select
                  name="preferred_staff_id"
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue=""
                >
                  <option value="">未指定</option>
                  {waitlistStaffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                連絡方法
                <select
                  name="channel"
                  defaultValue={waitlistCustomer.line_id ? 'line' : waitlistCustomer.phone_number ? 'phone' : 'manual'}
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="manual">手動</option>
                  <option value="line">LINE</option>
                  <option value="phone">電話</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望開始
                <Input type="datetime-local" name="desired_from" />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望終了
                <Input type="datetime-local" name="desired_to" />
              </label>
            </div>
            <label className="space-y-2 text-sm text-gray-700">
              メモ
              <Input name="notes" placeholder="木曜午前の空き枠優先" />
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit">waitlist を登録</Button>
              <Link href={modalCloseHref} className="text-sm text-gray-500">
                閉じる
              </Link>
            </div>
          </form>
        </CustomerCreateModal>
      ) : null}
    </section>
  )
}
