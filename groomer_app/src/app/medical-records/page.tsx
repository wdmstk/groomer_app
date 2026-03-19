import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { MedicalRecordShareButton } from '@/components/medical-records/MedicalRecordShareButton'
import { MedicalRecordVideoLineShareButton } from '@/components/medical-records/MedicalRecordVideoLineShareButton'
import {
  createSignedPhotoUrlMap,
  type MedicalRecordPhotoDraft,
  type MedicalRecordPhotoType,
} from '@/lib/medical-records/photos'
import { createSignedVideoUrlMap } from '@/lib/medical-records/videos'
import {
  buildMedicalRecordTagFilterOptions,
  filterMedicalRecordsByAi,
  getMedicalRecordAiStatusOptions,
  getVisibleMedicalRecordTags,
  type MedicalRecordAiFilterStatus,
} from '@/lib/medical-records/tag-usage'
import {
  getMedicalRecordAiTagStatusLabel,
  getMedicalRecordAiTagStatusTone,
  type MedicalRecordAiTagStatus,
} from '@/lib/medical-records/tags.ts'

const MedicalRecordCreateModal = nextDynamic(
  () => import('@/components/medical-records/MedicalRecordCreateModal').then((mod) => mod.MedicalRecordCreateModal)
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PetOption = {
  id: string
  name: string
}

type StaffOption = {
  id: string
  full_name: string
}

type AppointmentSummary = {
  id: string
  pet_id: string
  staff_id: string
  start_time: string
  menu: string | null
  duration: number | null
  customer_id: string | null
  customers?: { id: string; full_name: string | null; line_id: string | null } | { id: string; full_name: string | null; line_id: string | null }[] | null
  staffs?: { full_name: string } | { full_name: string }[] | null
}

type PendingAppointment = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string | null
  menu: string | null
  duration: number | null
  customers?: { full_name: string } | { full_name: string }[] | null
  pets?: { name: string } | { name: string }[] | null
  staffs?: { full_name: string } | { full_name: string }[] | null
}

type PendingPayment = {
  id: string
  appointment_id: string | null
  total_amount: number | null
  paid_at: string | null
  method: string | null
  created_at: string
}

type EditRecord = {
  id: string
  pet_id: string | null
  staff_id: string | null
  appointment_id: string | null
  payment_id: string | null
  status: 'draft' | 'finalized' | null
  finalized_at: string | null
  ai_tag_status: string | null
  ai_tag_error: string | null
  ai_tag_last_analyzed_at: string | null
  ai_tag_source: string | null
  record_date: string | null
  menu: string | null
  duration: number | null
  shampoo_used: string | null
  skin_condition: string | null
  behavior_notes: string | null
  photos: string[] | null
  caution_notes: string | null
  tags: string[] | null
}

type RecordPhotoRow = {
  id: string
  medical_record_id: string
  photo_type: MedicalRecordPhotoType
  storage_path: string
  comment: string | null
  sort_order: number
  taken_at: string | null
}

type RecordPhotoCountRow = {
  medical_record_id: string
}

type RecordVideoCountRow = {
  medical_record_id: string
}

type GalleryPhotoRow = {
  id: string
  photo_type: MedicalRecordPhotoType
  storage_path: string
  comment: string | null
  taken_at: string | null
  medical_records?:
    | { record_date: string | null; menu: string | null }
    | { record_date: string | null; menu: string | null }[]
    | null
}

type RecentMediaPhotoRow = {
  id: string
  medical_record_id: string
  photo_type: MedicalRecordPhotoType
  storage_path: string
  taken_at: string | null
  created_at: string
}

type RecentMediaVideoRow = {
  id: string
  medical_record_id: string
  storage_path: string
  thumbnail_path: string | null
  taken_at: string | null
  created_at: string
  duration_sec: number | null
  source_type: 'uploaded' | 'ai_generated' | null
}

type MixedMediaEntry =
  | {
      id: string
      medicalRecordId: string
      mediaType: 'photo'
      label: string
      signedUrl: string | null
      takenAt: string | null
      createdAt: string
    }
  | {
      id: string
      medicalRecordId: string
      mediaType: 'video'
      label: string
      signedUrl: string | null
      takenAt: string | null
      createdAt: string
      durationSec: number | null
      sourceType: 'uploaded' | 'ai_generated' | null
    }

type MedicalRecordsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
    appointment_id?: string
    payment_id?: string
    ai_tag?: string
    ai_status?: string
  }>
}

function getRelatedValue<T extends Record<string, string | null>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

function getRelationObject<T extends Record<string, string | null>>(
  relation: T | T[] | null | undefined
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function formatDateTimeJst(value: string | null | undefined) {
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

function formatDurationSec(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '未設定'
  const total = Math.max(0, Math.floor(value))
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function normalizeAiTagStatus(value: string | null | undefined): MedicalRecordAiTagStatus {
  switch (value) {
    case 'queued':
    case 'processing':
    case 'completed':
    case 'failed':
      return value
    default:
      return 'idle'
  }
}

function buildMedicalRecordsHref(params: {
  tab: 'list' | 'pending'
  aiTag?: string
  aiStatus?: string
  modal?: string
  edit?: string
  appointmentId?: string
  paymentId?: string
}) {
  const search = new URLSearchParams()
  search.set('tab', params.tab)
  if (params.aiTag) search.set('ai_tag', params.aiTag)
  if (params.aiStatus && params.aiStatus !== 'all') search.set('ai_status', params.aiStatus)
  if (params.modal) search.set('modal', params.modal)
  if (params.edit) search.set('edit', params.edit)
  if (params.appointmentId) search.set('appointment_id', params.appointmentId)
  if (params.paymentId) search.set('payment_id', params.paymentId)
  return `/medical-records?${search.toString()}`
}

export default async function MedicalRecordsPage({ searchParams }: MedicalRecordsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab =
    resolvedSearchParams?.tab === 'pending'
      ? 'pending'
      : 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const prefillAppointmentId = resolvedSearchParams?.appointment_id ?? ''
  const prefillPaymentId = resolvedSearchParams?.payment_id ?? ''
  const selectedAiTag = resolvedSearchParams?.ai_tag?.trim() ?? ''
  const selectedAiStatus = (
    ['queued', 'processing', 'completed', 'failed', 'idle'].includes(resolvedSearchParams?.ai_status ?? '')
      ? resolvedSearchParams?.ai_status
      : 'all'
  ) as MedicalRecordAiFilterStatus
  const needsFormSupportData =
    activeTab === 'pending' || isCreateModalOpen || Boolean(editId) || Boolean(prefillAppointmentId) || Boolean(prefillPaymentId)
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: medicalRecords } = await supabase
    .from('medical_records')
    .select(
      'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, ai_tag_status, ai_tag_error, ai_tag_last_analyzed_at, ai_tag_source, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes, tags, pets(name), staffs(full_name)'
    )
    .eq('store_id', storeId)
    .order('record_date', { ascending: false })

  const { data: pets } =
    needsFormSupportData
      ? await supabase
          .from('pets')
          .select('id, name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      : { data: [] }

  const { data: staffs } =
    needsFormSupportData
      ? await supabase
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      : { data: [] }

  const { data: appointments } =
    needsFormSupportData
      ? await supabase
          .from('appointments')
          .select('id, customer_id, pet_id, staff_id, start_time, menu, duration, customers(full_name), pets(name), staffs(full_name)')
          .eq('store_id', storeId)
          .order('start_time', { ascending: false })
      : { data: [] }

  const { data: payments } =
    needsFormSupportData
      ? await supabase
          .from('payments')
          .select('id, appointment_id, total_amount, paid_at, method, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      : { data: [] }

  const { data: editRecord } = editId
    ? await supabase
        .from('medical_records')
        .select(
          'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, ai_tag_status, ai_tag_error, ai_tag_last_analyzed_at, ai_tag_source, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes, tags'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const { data: prefillPayment } =
    !editId && prefillPaymentId
      ? await supabase
          .from('payments')
          .select('id, appointment_id')
          .eq('id', prefillPaymentId)
          .eq('store_id', storeId)
          .maybeSingle()
      : { data: null }

  const effectiveLinkedAppointmentId =
    prefillAppointmentId || prefillPayment?.appointment_id || editRecord?.appointment_id || ''

  const { data: prefillAppointment } =
    effectiveLinkedAppointmentId
      ? await supabase
          .from('appointments')
          .select('id, customer_id, pet_id, staff_id, start_time, menu, duration, customers(id, full_name, line_id), staffs(full_name)')
          .eq('id', effectiveLinkedAppointmentId)
          .eq('store_id', storeId)
          .maybeSingle()
      : { data: null }

  const recordList = (medicalRecords ?? []) as Array<
    EditRecord & {
      pets?: { name: string } | { name: string }[] | null
      staffs?: { full_name: string } | { full_name: string }[] | null
    }
  >
  const petNameByRecordId = new Map<string, string>()
  recordList.forEach((record) => {
    petNameByRecordId.set(record.id, getRelatedValue(record.pets, 'name'))
  })
  const aiTagFilterOptions = buildMedicalRecordTagFilterOptions(recordList)
  const aiStatusOptions = getMedicalRecordAiStatusOptions(recordList)
  const filteredRecordList = filterMedicalRecordsByAi(recordList, {
    status: selectedAiStatus,
    tag: selectedAiTag,
  })
  const appointmentList = (appointments ?? []) as PendingAppointment[]
  const paymentList = (payments ?? []) as PendingPayment[]
  const petOptions: PetOption[] = pets ?? []
  const staffOptions: StaffOption[] = staffs ?? []
  const linkedAppointmentId = editRecord?.appointment_id ?? prefillAppointment?.id ?? ''
  const linkedPaymentId = editRecord?.payment_id ?? prefillPayment?.id ?? ''
  const defaultRecordDate = editRecord?.record_date ?? prefillAppointment?.start_time ?? ''
  const defaultMenu = editRecord?.menu ?? prefillAppointment?.menu ?? ''
  const defaultDuration =
    editRecord?.duration?.toString() ?? (prefillAppointment?.duration ? String(prefillAppointment.duration) : '')
  const defaultStatus = editRecord?.status === 'finalized' ? 'finalized' : 'draft'
  const defaultPetId = editRecord?.pet_id ?? prefillAppointment?.pet_id ?? ''
  const defaultStaffId = editRecord?.staff_id ?? prefillAppointment?.staff_id ?? ''
  const paymentOptions = paymentList
    .filter((payment) => payment.appointment_id === linkedAppointmentId)
    .map((payment) => ({
      id: payment.id,
      label: `${formatDateTimeJst(payment.paid_at)} / ${payment.method ?? '未設定'} / ${
        payment.total_amount ? `${payment.total_amount.toLocaleString()}円` : '金額未設定'
      }`,
    }))

  const linkedAppointmentSummary = prefillAppointment as AppointmentSummary | null
  const linkedAppointmentCustomer = (() => {
    if (!linkedAppointmentSummary?.customers) return null
    if (Array.isArray(linkedAppointmentSummary.customers)) {
      return linkedAppointmentSummary.customers[0] ?? null
    }
    return linkedAppointmentSummary.customers
  })()
  const linkedAppointmentStaffName = (() => {
    if (!linkedAppointmentSummary?.staffs) return null
    if (Array.isArray(linkedAppointmentSummary.staffs)) {
      return linkedAppointmentSummary.staffs[0]?.full_name ?? null
    }
    return linkedAppointmentSummary.staffs.full_name ?? null
  })()
  const linkedAppointmentIds = new Set(
    recordList
      .map((record) => record.appointment_id)
      .filter((id): id is string => Boolean(id))
  )
  const linkedPaymentIds = new Set(
    recordList
      .map((record) => record.payment_id)
      .filter((id): id is string => Boolean(id))
  )
  const pendingAppointments = appointmentList.filter(
    (appointment) => !linkedAppointmentIds.has(appointment.id)
  )
  const appointmentById = new Map(appointmentList.map((appointment) => [appointment.id, appointment]))
  const pendingPayments = paymentList.filter((payment) => !linkedPaymentIds.has(payment.id))
  const draftRecordByAppointmentId = new Map(
    recordList
      .filter((record) => record.status !== 'finalized' && record.appointment_id)
      .map((record) => [record.appointment_id as string, record.id])
  )
  const modalCloseRedirect = `/medical-records?tab=${activeTab}`

  const recordIds = recordList.map((record) => record.id)
  const currentGalleryPetId = defaultPetId

  const { data: recordPhotoCounts } =
    recordIds.length > 0
      ? await supabase
          .from('medical_record_photos')
          .select('medical_record_id')
          .eq('store_id', storeId)
          .in('medical_record_id', recordIds)
      : { data: [] }

  const { data: recordVideoCounts } =
    recordIds.length > 0
      ? await supabase
          .from('medical_record_videos' as never)
          .select('medical_record_id')
          .eq('store_id', storeId)
          .in('medical_record_id', recordIds)
      : { data: [] }

  const { data: editRecordPhotos } =
    editRecord
      ? await supabase
          .from('medical_record_photos')
          .select('id, medical_record_id, photo_type, storage_path, comment, sort_order, taken_at')
          .eq('store_id', storeId)
          .eq('medical_record_id', editRecord.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      : { data: [] }

  const { data: galleryPhotos } =
    currentGalleryPetId
      ? await supabase
          .from('medical_record_photos')
          .select('id, photo_type, storage_path, comment, taken_at, medical_records(record_date, menu)')
          .eq('store_id', storeId)
          .eq('pet_id', currentGalleryPetId)
          .order('taken_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(24)
      : { data: [] }

  const [{ data: recentPhotos }, { data: recentVideos }] = await Promise.all([
    supabase
      .from('medical_record_photos')
      .select('id, medical_record_id, photo_type, storage_path, taken_at, created_at')
      .eq('store_id', storeId)
      .order('taken_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(18),
    supabase
      .from('medical_record_videos' as never)
      .select('id, medical_record_id, storage_path, thumbnail_path, taken_at, created_at, duration_sec, source_type')
      .eq('store_id', storeId)
      .order('taken_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(18),
  ])

  const signedUrlMap = await createSignedPhotoUrlMap(
    supabase,
    [
      ...((editRecordPhotos ?? []) as RecordPhotoRow[]).map((photo) => photo.storage_path),
      ...((galleryPhotos ?? []) as GalleryPhotoRow[]).map((photo) => photo.storage_path),
    ],
    60 * 60
  )

  const recentVideoRows = (recentVideos ?? []) as RecentMediaVideoRow[]
  const recentVideoPreviewPaths = recentVideoRows.map((video) => video.thumbnail_path || video.storage_path)
  const signedVideoUrlMap = await createSignedVideoUrlMap(supabase, recentVideoPreviewPaths, 60 * 60)

  const photoEntriesByRecordId = new Map<string, MedicalRecordPhotoDraft[]>()
  ;((editRecordPhotos ?? []) as RecordPhotoRow[]).forEach((photo) => {
    const current = photoEntriesByRecordId.get(photo.medical_record_id) ?? []
    current.push({
      id: photo.id,
      photoType: photo.photo_type,
      storagePath: photo.storage_path,
      comment: photo.comment ?? '',
      sortOrder: photo.sort_order,
      takenAt: photo.taken_at,
      signedUrl: signedUrlMap.get(photo.storage_path) ?? null,
    })
    photoEntriesByRecordId.set(photo.medical_record_id, current)
  })

  const galleryEntries = ((galleryPhotos ?? []) as GalleryPhotoRow[]).map((photo) => {
    const record = getRelationObject(photo.medical_records)
    return {
      id: photo.id,
      photoType: photo.photo_type,
      signedUrl: signedUrlMap.get(photo.storage_path) ?? null,
      comment: photo.comment ?? '',
      takenAt: photo.taken_at,
      recordDate: record?.record_date ?? null,
      menu: record?.menu ?? null,
    }
  })

  const editPhotoEntries = editRecord ? photoEntriesByRecordId.get(editRecord.id) ?? [] : []
  const photoCountByRecordId = new Map<string, number>()
  ;((recordPhotoCounts ?? []) as RecordPhotoCountRow[]).forEach((row) => {
    photoCountByRecordId.set(row.medical_record_id, (photoCountByRecordId.get(row.medical_record_id) ?? 0) + 1)
  })
  const videoCountByRecordId = new Map<string, number>()
  ;((recordVideoCounts ?? []) as RecordVideoCountRow[]).forEach((row) => {
    videoCountByRecordId.set(row.medical_record_id, (videoCountByRecordId.get(row.medical_record_id) ?? 0) + 1)
  })

  const mixedMediaEntries: MixedMediaEntry[] = [
    ...((recentPhotos ?? []) as RecentMediaPhotoRow[]).map((photo) => ({
      id: photo.id,
      medicalRecordId: photo.medical_record_id,
      mediaType: 'photo' as const,
      label: photo.photo_type === 'before' ? '写真(施術前)' : '写真(施術後)',
      signedUrl: signedUrlMap.get(photo.storage_path) ?? null,
      takenAt: photo.taken_at,
      createdAt: photo.created_at,
    })),
    ...recentVideoRows.map((video) => {
      const previewPath = video.thumbnail_path || video.storage_path
      return {
        id: video.id,
        medicalRecordId: video.medical_record_id,
        mediaType: 'video' as const,
        label: '動画',
        signedUrl: signedVideoUrlMap.get(previewPath) ?? null,
        takenAt: video.taken_at,
        createdAt: video.created_at,
        durationSec: video.duration_sec,
        sourceType: video.source_type,
      }
    }),
  ]
    .sort((a, b) => {
      const aTime = new Date(a.takenAt ?? a.createdAt).getTime()
      const bTime = new Date(b.takenAt ?? b.createdAt).getTime()
      return bTime - aTime
    })
    .slice(0, 24)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">ペットカルテ管理</h1>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/medical-records?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          カルテ一覧
        </Link>
        <Link
          href="/medical-records?tab=pending"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          未作成一覧
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">カルテ一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {filteredRecordList.length} 件 / 総数 {recordList.length} 件</p>
              <Link
                href={buildMedicalRecordsHref({
                  tab: 'list',
                  modal: 'create',
                  aiTag: selectedAiTag,
                  aiStatus: selectedAiStatus,
                })}
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {recordList.length === 0 ? (
            <p className="text-sm text-gray-500">カルテがまだ登録されていません。</p>
          ) : (
            <>
              <div className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">AI解析ステータス</p>
                  <div className="flex flex-wrap gap-2">
                    {aiStatusOptions.map((option) => {
                      const active = option.value === selectedAiStatus
                      return (
                        <Link
                          key={option.value}
                          href={buildMedicalRecordsHref({
                            tab: 'list',
                            aiTag: selectedAiTag,
                            aiStatus: option.value,
                          })}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                          }`}
                        >
                          {option.label} {option.count}
                        </Link>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">AIタグで絞り込み</p>
                    {selectedAiTag ? (
                      <Link
                        href={buildMedicalRecordsHref({
                          tab: 'list',
                          aiStatus: selectedAiStatus,
                        })}
                        className="text-xs font-semibold text-blue-600"
                      >
                        タグ絞り込みを解除
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiTagFilterOptions.length > 0 ? (
                      aiTagFilterOptions.map((option) => {
                        const active = option.tag === selectedAiTag
                        return (
                          <Link
                            key={option.tag}
                            href={buildMedicalRecordsHref({
                              tab: 'list',
                              aiTag: option.tag,
                              aiStatus: selectedAiStatus,
                            })}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              active ? 'bg-violet-700 text-white' : 'bg-white text-violet-900'
                            }`}
                          >
                            {option.tag} {option.count}
                          </Link>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-500">AIタグ付きカルテはまだありません。</p>
                    )}
                  </div>
                  {selectedAiTag || selectedAiStatus !== 'all' ? (
                    <p className="text-xs text-slate-600">
                      現在の条件:
                      {selectedAiStatus !== 'all' ? ` 解析=${aiStatusOptions.find((option) => option.value === selectedAiStatus)?.label}` : ' 解析=すべて'}
                      {selectedAiTag ? ` / タグ=${selectedAiTag}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600">一覧から気になるタグを押すと、対象カルテだけに絞り込めます。</p>
                  )}
                </div>
              </div>

              {filteredRecordList.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                  条件に一致するカルテはありません。
                </div>
              ) : null}

              <div className="space-y-3 md:hidden">
                {filteredRecordList.map((record) => {
                  const aiStatus = normalizeAiTagStatus(record.ai_tag_status)
                  const visibleTags = getVisibleMedicalRecordTags(record.tags, 4)

                  return (
                    <article key={record.id} className="rounded border p-3 text-sm text-gray-700">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-gray-900">{getRelatedValue(record.pets, 'name')}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getMedicalRecordAiTagStatusTone(aiStatus)}`}
                      >
                        {getMedicalRecordAiTagStatusLabel(aiStatus)}
                      </span>
                    </div>
                    <p>担当: {getRelatedValue(record.staffs, 'full_name')}</p>
                    <p>施術日時: {formatDateTimeJst(record.record_date)}</p>
                    <p>メニュー: {record.menu ?? '未登録'}</p>
                    <p>状態: {record.status === 'finalized' ? '確定' : '下書き'}</p>
                    <p>
                      メディア: {(photoCountByRecordId.get(record.id) ?? 0) + (videoCountByRecordId.get(record.id) ?? 0)} 件
                      （写真 {photoCountByRecordId.get(record.id) ?? 0} / 動画 {videoCountByRecordId.get(record.id) ?? 0}）
                    </p>
                    <p>所要時間: {record.duration ? `${record.duration} 分` : '未登録'}</p>
                    <p>シャンプー: {record.shampoo_used ?? '未登録'}</p>
                    <p>皮膚状態: {record.skin_condition ?? '未登録'}</p>
                    <p>問題行動: {record.behavior_notes ?? '未登録'}</p>
                    <p>注意事項: {record.caution_notes ?? '未登録'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleTags.length > 0 ? (
                        visibleTags.map((tag) => (
                          <Link
                            key={tag}
                            href={buildMedicalRecordsHref({
                              tab: 'list',
                              aiTag: tag,
                              aiStatus: selectedAiStatus,
                            })}
                            className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-900"
                          >
                            {tag}
                          </Link>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">AIタグなし</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      最終解析: {record.ai_tag_last_analyzed_at ? formatDateTimeJst(record.ai_tag_last_analyzed_at) : '未実行'}
                    </p>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={buildMedicalRecordsHref({
                            tab: 'list',
                            edit: record.id,
                            aiTag: selectedAiTag,
                            aiStatus: selectedAiStatus,
                          })}
                          className="text-blue-600 text-sm"
                        >
                          編集
                        </Link>
                        <form action={`/api/medical-records/${record.id}`} method="post">
                          <input type="hidden" name="_method" value="delete" />
                          <Button type="submit" className="bg-red-500 hover:bg-red-600">
                            削除
                          </Button>
                        </form>
                      </div>
                      {record.status === 'finalized' ? <MedicalRecordShareButton recordId={record.id} /> : null}
                    </div>
                    </article>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm text-left">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2 px-2">ペット</th>
                      <th className="py-2 px-2">担当</th>
                      <th className="py-2 px-2">施術日時</th>
                      <th className="py-2 px-2">メニュー</th>
                      <th className="py-2 px-2">状態</th>
                      <th className="py-2 px-2">メディア</th>
                      <th className="py-2 px-2">所要時間</th>
                      <th className="py-2 px-2">シャンプー</th>
                      <th className="py-2 px-2">皮膚状態</th>
                      <th className="py-2 px-2">問題行動</th>
                      <th className="py-2 px-2">注意事項</th>
                      <th className="py-2 px-2">AIタグ</th>
                      <th className="py-2 px-2">AI解析</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRecordList.map((record) => {
                      const aiStatus = normalizeAiTagStatus(record.ai_tag_status)
                      const visibleTags = getVisibleMedicalRecordTags(record.tags)

                      return (
                        <tr key={record.id} className="text-gray-700 align-top">
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {getRelatedValue(record.pets, 'name')}
                        </td>
                        <td className="py-3 px-2">{getRelatedValue(record.staffs, 'full_name')}</td>
                        <td className="py-3 px-2">{formatDateTimeJst(record.record_date)}</td>
                        <td className="py-3 px-2">{record.menu ?? '未登録'}</td>
                        <td className="py-3 px-2">{record.status === 'finalized' ? '確定' : '下書き'}</td>
                        <td className="py-3 px-2">
                          {(photoCountByRecordId.get(record.id) ?? 0) + (videoCountByRecordId.get(record.id) ?? 0)} 件
                          <span className="block text-xs text-gray-500">
                            写真 {photoCountByRecordId.get(record.id) ?? 0} / 動画 {videoCountByRecordId.get(record.id) ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {record.duration ? `${record.duration} 分` : '未登録'}
                        </td>
                        <td className="py-3 px-2">{record.shampoo_used ?? '未登録'}</td>
                        <td className="py-3 px-2">{record.skin_condition ?? '未登録'}</td>
                        <td className="py-3 px-2">{record.behavior_notes ?? '未登録'}</td>
                        <td className="py-3 px-2">{record.caution_notes ?? '未登録'}</td>
                        <td className="py-3 px-2">
                          <div className="flex max-w-48 flex-wrap gap-1.5">
                            {visibleTags.length > 0 ? (
                              visibleTags.map((tag) => (
                                <Link
                                  key={tag}
                                  href={buildMedicalRecordsHref({
                                    tab: 'list',
                                    aiTag: tag,
                                    aiStatus: selectedAiStatus,
                                  })}
                                  className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-900"
                                >
                                  {tag}
                                </Link>
                              ))
                            ) : (
                              <span className="text-gray-500">なし</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getMedicalRecordAiTagStatusTone(aiStatus)}`}
                            >
                              {getMedicalRecordAiTagStatusLabel(aiStatus)}
                            </span>
                            <p className="text-xs text-gray-500">
                              {record.ai_tag_last_analyzed_at
                                ? `最終: ${formatDateTimeJst(record.ai_tag_last_analyzed_at)}`
                                : '最終: 未実行'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={buildMedicalRecordsHref({
                                  tab: 'list',
                                  edit: record.id,
                                  aiTag: selectedAiTag,
                                  aiStatus: selectedAiStatus,
                                })}
                                className="text-blue-600 text-sm"
                              >
                                編集
                              </Link>
                              <form action={`/api/medical-records/${record.id}`} method="post">
                                <input type="hidden" name="_method" value="delete" />
                                <Button type="submit" className="bg-red-500 hover:bg-red-600">
                                  削除
                                </Button>
                              </form>
                            </div>
                            {record.status === 'finalized' ? <MedicalRecordShareButton recordId={record.id} /> : null}
                          </div>
                        </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <section className="mt-6 space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">最新メディア（写真・動画）</h3>
                  <p className="text-xs text-gray-500">同一一覧で時系列表示</p>
                </div>
                {mixedMediaEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">表示できるメディアはまだありません。</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {mixedMediaEntries.map((entry) => {
                      const petName = petNameByRecordId.get(entry.medicalRecordId) ?? '未登録'
                      return (
                        <article key={`${entry.mediaType}-${entry.id}`} className="overflow-hidden rounded border">
                          <div className="relative aspect-[4/3] bg-slate-50">
                            {entry.signedUrl ? (
                              entry.mediaType === 'photo' ? (
                                <Image src={entry.signedUrl} alt="カルテ写真" fill className="object-cover" />
                              ) : (
                                <video
                                  src={entry.signedUrl}
                                  controls
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              )
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-gray-500">
                                プレビューなし
                              </div>
                            )}
                            <span
                              className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                entry.mediaType === 'photo'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {entry.mediaType === 'photo' ? '写真' : '動画'}
                            </span>
                            {entry.mediaType === 'video' ? (
                              <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
                                {formatDurationSec(entry.durationSec)}
                              </span>
                            ) : null}
                          </div>
                          <div className="space-y-1 p-3 text-xs text-gray-700">
                            <p className="font-semibold text-gray-900">{entry.label}</p>
                            <p>ペット: {petName}</p>
                            <p>日時: {formatDateTimeJst(entry.takenAt ?? entry.createdAt)}</p>
                            {entry.mediaType === 'video' && entry.sourceType === 'ai_generated' ? (
                              <p className="text-violet-700">AI生成動画</p>
                            ) : null}
                            {entry.mediaType === 'video' ? (
                              <MedicalRecordVideoLineShareButton videoId={entry.id} />
                            ) : null}
                            <Link
                              href={buildMedicalRecordsHref({
                                tab: 'list',
                                edit: entry.medicalRecordId,
                                aiTag: selectedAiTag,
                                aiStatus: selectedAiStatus,
                              })}
                              className="inline-flex text-xs font-semibold text-blue-600"
                            >
                              このカルテを開く
                            </Link>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </Card>
      ) : (
        <Card>
          <div className="space-y-6">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">カルテ未作成の予約</h2>
                <p className="text-sm text-gray-500">全 {pendingAppointments.length} 件</p>
              </div>
              {pendingAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">未作成の予約はありません。</p>
              ) : (
                <div className="space-y-3 md:hidden">
                  {pendingAppointments.map((appointment) => (
                    <article key={appointment.id} className="rounded border p-3 text-sm text-gray-700">
                      <p className="font-semibold text-gray-900">{getRelatedValue(appointment.pets, 'name')}</p>
                      <p>顧客: {getRelatedValue(appointment.customers, 'full_name')}</p>
                      <p>担当: {getRelatedValue(appointment.staffs, 'full_name')}</p>
                      <p>施術日時: {formatDateTimeJst(appointment.start_time)}</p>
                      <p>メニュー: {appointment.menu ?? '未設定'}</p>
                      <p>所要時間: {appointment.duration ? `${appointment.duration} 分` : '未設定'}</p>
                      <Link
                        href={`/medical-records?tab=pending&appointment_id=${appointment.id}`}
                        className="mt-2 inline-block text-blue-600"
                      >
                        カルテ登録
                      </Link>
                    </article>
                  ))}
                </div>
              )}
              {pendingAppointments.length > 0 ? (
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm text-left">
                    <thead className="border-b text-gray-500">
                      <tr>
                        <th className="px-2 py-2">顧客</th>
                        <th className="px-2 py-2">ペット</th>
                        <th className="px-2 py-2">担当</th>
                        <th className="px-2 py-2">施術日時</th>
                        <th className="px-2 py-2">メニュー</th>
                        <th className="px-2 py-2">所要時間</th>
                        <th className="px-2 py-2">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingAppointments.map((appointment) => (
                        <tr key={appointment.id} className="text-gray-700">
                          <td className="px-2 py-3">{getRelatedValue(appointment.customers, 'full_name')}</td>
                          <td className="px-2 py-3">{getRelatedValue(appointment.pets, 'name')}</td>
                          <td className="px-2 py-3">{getRelatedValue(appointment.staffs, 'full_name')}</td>
                          <td className="px-2 py-3">{formatDateTimeJst(appointment.start_time)}</td>
                          <td className="px-2 py-3">{appointment.menu ?? '未設定'}</td>
                          <td className="px-2 py-3">
                            {appointment.duration ? `${appointment.duration} 分` : '未設定'}
                          </td>
                          <td className="px-2 py-3">
                            <Link
                              href={`/medical-records?tab=pending&appointment_id=${appointment.id}`}
                              className="text-blue-600"
                            >
                              カルテ登録
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">カルテ未作成の会計</h2>
                <p className="text-sm text-gray-500">全 {pendingPayments.length} 件</p>
              </div>
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-gray-500">未作成の会計はありません。</p>
              ) : (
                <div className="space-y-3 md:hidden">
                  {pendingPayments.map((payment) => {
                    const appointment = payment.appointment_id
                      ? appointmentById.get(payment.appointment_id) ?? null
                      : null
                    return (
                      <article key={payment.id} className="rounded border p-3 text-sm text-gray-700">
                        <p className="font-semibold text-gray-900">会計ID: {payment.id}</p>
                        <p>顧客: {appointment ? getRelatedValue(appointment.customers, 'full_name') : '未設定'}</p>
                        <p>ペット: {appointment ? getRelatedValue(appointment.pets, 'name') : '未設定'}</p>
                        <p>施術日時: {formatDateTimeJst(appointment?.start_time ?? null)}</p>
                        <p>会計日時: {formatDateTimeJst(payment.paid_at)}</p>
                        <p>支払方法: {payment.method ?? '未設定'}</p>
                        <p>金額: {payment.total_amount ? `${payment.total_amount.toLocaleString()} 円` : '未設定'}</p>
                        <Link
                          href={
                            appointment && draftRecordByAppointmentId.has(appointment.id)
                              ? `/medical-records?tab=pending&edit=${draftRecordByAppointmentId.get(appointment.id)}&payment_id=${payment.id}`
                              : `/medical-records?tab=pending&payment_id=${payment.id}`
                          }
                          className="mt-2 inline-block text-blue-600"
                        >
                          カルテ登録
                        </Link>
                      </article>
                    )
                  })}
                </div>
              )}
              {pendingPayments.length > 0 ? (
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm text-left">
                    <thead className="border-b text-gray-500">
                      <tr>
                        <th className="px-2 py-2">会計ID</th>
                        <th className="px-2 py-2">顧客</th>
                        <th className="px-2 py-2">ペット</th>
                        <th className="px-2 py-2">施術日時</th>
                        <th className="px-2 py-2">会計日時</th>
                        <th className="px-2 py-2">支払方法</th>
                        <th className="px-2 py-2">金額</th>
                        <th className="px-2 py-2">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingPayments.map((payment) => {
                        const appointment = payment.appointment_id
                          ? appointmentById.get(payment.appointment_id) ?? null
                          : null
                        return (
                          <tr key={payment.id} className="text-gray-700">
                            <td className="px-2 py-3">{payment.id}</td>
                            <td className="px-2 py-3">
                              {appointment ? getRelatedValue(appointment.customers, 'full_name') : '未設定'}
                            </td>
                            <td className="px-2 py-3">
                              {appointment ? getRelatedValue(appointment.pets, 'name') : '未設定'}
                            </td>
                            <td className="px-2 py-3">{formatDateTimeJst(appointment?.start_time ?? null)}</td>
                            <td className="px-2 py-3">{formatDateTimeJst(payment.paid_at)}</td>
                            <td className="px-2 py-3">{payment.method ?? '未設定'}</td>
                            <td className="px-2 py-3">
                              {payment.total_amount ? `${payment.total_amount.toLocaleString()} 円` : '未設定'}
                            </td>
                            <td className="px-2 py-3">
                              <Link
                                href={
                                  appointment && draftRecordByAppointmentId.has(appointment.id)
                                    ? `/medical-records?tab=pending&edit=${draftRecordByAppointmentId.get(appointment.id)}&payment_id=${payment.id}`
                                    : `/medical-records?tab=pending&payment_id=${payment.id}`
                                }
                                className="text-blue-600"
                              >
                                カルテ登録
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </div>
        </Card>
      )}

      {isCreateModalOpen || editRecord || prefillAppointmentId || prefillPaymentId ? (
        <MedicalRecordCreateModal
          editRecord={editRecord}
          petOptions={petOptions}
          staffOptions={staffOptions}
          formAction={editRecord ? `/api/medical-records/${editRecord.id}` : '/api/medical-records'}
          linkedAppointmentId={linkedAppointmentId}
          linkedPaymentId={linkedPaymentId}
          linkedAppointmentSummary={
            linkedAppointmentSummary
              ? {
                  id: linkedAppointmentSummary.id,
                  start_time: linkedAppointmentSummary.start_time,
                  menu: linkedAppointmentSummary.menu,
                  duration: linkedAppointmentSummary.duration,
                  staff_name: linkedAppointmentStaffName,
                }
              : null
          }
          linkedCustomerSummary={
            linkedAppointmentCustomer
              ? {
                  id: linkedAppointmentCustomer.id,
                  full_name: linkedAppointmentCustomer.full_name ?? null,
                  hasLineId: Boolean(linkedAppointmentCustomer.line_id),
                }
              : null
          }
          defaultPetId={defaultPetId}
          defaultStaffId={defaultStaffId}
          defaultRecordDate={defaultRecordDate}
          defaultMenu={defaultMenu}
          defaultDuration={defaultDuration}
          paymentOptions={paymentOptions}
          defaultStatus={defaultStatus}
          closeRedirectTo={modalCloseRedirect}
          photoEntries={editPhotoEntries}
          galleryEntries={galleryEntries}
        />
      ) : null}
    </section>
  )
}
