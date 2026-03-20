'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'
import {
  getMedicalRecordAiTagStatusLabel,
  getMedicalRecordAiTagStatusTone,
  normalizeMedicalRecordAiTagStatus,
  type MedicalRecordAiTagStatus,
} from '@/lib/medical-records/tags'
import type {
  MedicalRecordPhotoDraft,
  MedicalRecordPhotoType,
} from '@/lib/medical-records/photos'
import type { MedicalRecordVideoDraft } from '@/lib/medical-records/videos'
import { MedicalRecordVideoThumbnailButton } from '@/components/medical-records/MedicalRecordVideoThumbnailButton'

type PetOption = {
  id: string
  name: string
}

type StaffOption = {
  id: string
  full_name: string
}

type EditRecord = {
  id: string
  pet_id: string | null
  staff_id: string | null
  appointment_id: string | null
  payment_id: string | null
  status?: 'draft' | 'finalized' | null
  finalized_at?: string | null
  record_date: string | null
  menu: string | null
  duration: number | null
  shampoo_used: string | null
  skin_condition: string | null
  behavior_notes: string | null
  photos: string[] | null
  caution_notes: string | null
  tags?: string[] | null
  ai_tag_status?: string | null
  ai_tag_error?: string | null
  ai_tag_last_analyzed_at?: string | null
  ai_tag_source?: string | null
}

type LinkedAppointmentSummary = {
  id: string
  start_time: string | null
  menu: string | null
  duration: number | null
  staff_name: string | null
} | null

type LinkedCustomerSummary = {
  id: string
  full_name: string | null
  hasLineId: boolean
} | null

type PaymentOption = {
  id: string
  label: string
}

type GalleryEntry = {
  id: string
  photoType: MedicalRecordPhotoType
  signedUrl: string | null
  comment: string
  takenAt: string | null
  recordDate: string | null
  menu: string | null
}

type MedicalRecordCreateModalProps = {
  editRecord: EditRecord | null
  petOptions: PetOption[]
  staffOptions: StaffOption[]
  formAction: string
  linkedAppointmentId: string
  linkedPaymentId: string
  linkedAppointmentSummary: LinkedAppointmentSummary
  linkedCustomerSummary: LinkedCustomerSummary
  paymentOptions: PaymentOption[]
  defaultPetId: string
  defaultStaffId: string
  defaultRecordDate: string
  defaultMenu: string
  defaultDuration: string
  defaultStatus?: 'draft' | 'finalized'
  closeRedirectTo?: string
  photoEntries?: MedicalRecordPhotoDraft[]
  videoEntries?: MedicalRecordVideoDraft[]
  galleryEntries?: GalleryEntry[]
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
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

function splitTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,、]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function MedicalRecordCreateModal({
  editRecord,
  petOptions,
  staffOptions,
  formAction,
  linkedAppointmentId,
  linkedPaymentId,
  linkedAppointmentSummary,
  linkedCustomerSummary,
  paymentOptions,
  defaultPetId,
  defaultStaffId,
  defaultRecordDate,
  defaultMenu,
  defaultDuration,
  defaultStatus = 'draft',
  closeRedirectTo = '/medical-records?tab=list',
  photoEntries = [],
  videoEntries = [],
  galleryEntries = [],
}: MedicalRecordCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [petId, setPetId] = useState(defaultPetId)
  const [recordDate, setRecordDate] = useState(toDateTimeLocalValue(defaultRecordDate))
  const [photos, setPhotos] = useState<MedicalRecordPhotoDraft[]>(photoEntries)
  const [tagInput, setTagInput] = useState((editRecord?.tags ?? []).join(', '))
  const [videos, setVideos] = useState<MedicalRecordVideoDraft[]>(videoEntries)
  const [uploading, setUploading] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [videoUploadError, setVideoUploadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [savedRecordId, setSavedRecordId] = useState(editRecord?.id ?? '')
  const [savedStatus, setSavedStatus] = useState<'draft' | 'finalized'>(defaultStatus)
  const [aiTagStatus, setAiTagStatus] = useState<MedicalRecordAiTagStatus>(
    normalizeMedicalRecordAiTagStatus(editRecord?.ai_tag_status)
  )
  const [aiTagError, setAiTagError] = useState(editRecord?.ai_tag_error ?? '')
  const [aiTagLastAnalyzedAt, setAiTagLastAnalyzedAt] = useState(editRecord?.ai_tag_last_analyzed_at ?? '')
  const [aiTagSource, setAiTagSource] = useState(editRecord?.ai_tag_source ?? '')
  const [aiTagLoading, setAiTagLoading] = useState(false)
  const [aiTagMessage, setAiTagMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [lineSending, setLineSending] = useState(false)
  const [lineError, setLineError] = useState('')
  const [lineMessage, setLineMessage] = useState('')
  const beforeInputRef = useRef<HTMLInputElement | null>(null)
  const afterInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)

  const handleClose = useCallback(() => {
    if (closeRedirectTo) {
      router.push(closeRedirectTo)
      return
    }
    setOpen(false)
  }, [closeRedirectTo, router])

  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open,
    onClose: handleClose,
  })

  const handleUploadPhotos = async (
    event: ChangeEvent<HTMLInputElement>,
    requestedPhotoType: MedicalRecordPhotoType
  ) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!petId || !recordDate) {
      setUploadError('写真アップロード前にペットと施術日時を入力してください。')
      event.target.value = ''
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('petId', petId)
        formData.append('recordDate', new Date(recordDate).toISOString())
        formData.append('photoType', requestedPhotoType)
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const payload = (await response.json().catch(() => null)) as
          | { storagePath?: string; signedUrl?: string | null; error?: string }
          | null
        if (!response.ok || !payload?.storagePath) {
          throw new Error(payload?.error ?? '写真アップロードに失敗しました。')
        }
        setPhotos((prev) => [
          ...prev,
          {
            photoType: requestedPhotoType,
            storagePath: payload.storagePath as string,
            comment: '',
            sortOrder: prev.length,
            takenAt: new Date(recordDate).toISOString(),
            signedUrl: payload.signedUrl ?? null,
          },
        ])
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '写真アップロードに失敗しました。')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const statusValue = formData.get('status')
    const nextStatus = statusValue === 'finalized' ? 'finalized' : 'draft'

    setSaving(true)
    setSaveError('')
    setSaveMessage('')
    setShareUrl('')
    setShareError('')
    setLineError('')
    setLineMessage('')

    try {
      const response = await fetch(formAction, {
        method: 'POST',
        body: formData,
        headers: {
          accept: 'application/json',
        },
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            id?: string
            record?: {
              id?: string
              tags?: string[] | null
              ai_tag_status?: string | null
              ai_tag_error?: string | null
              ai_tag_last_analyzed_at?: string | null
              ai_tag_source?: string | null
            }
            message?: string
          }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'カルテの保存に失敗しました。')
      }

      const nextRecordId = payload?.id ?? payload?.record?.id ?? editRecord?.id ?? ''
      setSavedRecordId(nextRecordId)
      setSavedStatus(nextStatus)
      setAiTagStatus(normalizeMedicalRecordAiTagStatus(payload?.record?.ai_tag_status))
      setAiTagError(payload?.record?.ai_tag_error ?? '')
      setAiTagLastAnalyzedAt(payload?.record?.ai_tag_last_analyzed_at ?? '')
      setAiTagSource(payload?.record?.ai_tag_source ?? '')
      setTagInput((payload?.record?.tags ?? splitTagInput(tagInput)).join(', '))
      setSaveMessage(nextStatus === 'finalized' ? 'カルテを確定しました。共有できます。' : '下書きを保存しました。')
      router.refresh()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'カルテの保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadVideos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!petId || !recordDate) {
      setVideoUploadError('動画アップロード前にペットと施術日時を入力してください。')
      event.target.value = ''
      return
    }

    setVideoUploading(true)
    setVideoUploadError('')
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('petId', petId)
        formData.append('recordDate', new Date(recordDate).toISOString())
        const response = await fetch('/api/upload/video', {
          method: 'POST',
          body: formData,
        })
        const payload = (await response.json().catch(() => null)) as
          | { storagePath?: string; signedUrl?: string | null; error?: string }
          | null
        if (!response.ok || !payload?.storagePath) {
          throw new Error(payload?.error ?? '動画アップロードに失敗しました。')
        }

        setVideos((prev) => [
          ...prev,
          {
            storagePath: payload.storagePath,
            thumbnailPath: null,
            lineShortPath: null,
            durationSec: null,
            sizeBytes: file.size,
            sourceType: 'uploaded',
            comment: '',
            sortOrder: prev.length,
            takenAt: new Date(recordDate).toISOString(),
            signedUrl: payload.signedUrl ?? null,
          },
        ])
      }
    } catch (error) {
      setVideoUploadError(error instanceof Error ? error.message : '動画アップロードに失敗しました。')
    } finally {
      setVideoUploading(false)
      event.target.value = ''
    }
  }

  const handleCreateShare = async () => {
    if (!savedRecordId) return
    setShareLoading(true)
    setShareError('')
    try {
      const response = await fetch(`/api/medical-records/${savedRecordId}/share`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as
        | { shareUrl?: string; message?: string }
        | null
      if (!response.ok || !payload?.shareUrl) {
        throw new Error(payload?.message ?? '共有URLの発行に失敗しました。')
      }
      setShareUrl(payload.shareUrl)
      await navigator.clipboard.writeText(payload.shareUrl).catch(() => undefined)
    } catch (error) {
      setShareError(error instanceof Error ? error.message : '共有URLの発行に失敗しました。')
    } finally {
      setShareLoading(false)
    }
  }

  const handleRunAiTagAnalysis = async (action: 'queue' | 'retry') => {
    const targetRecordId = savedRecordId || editRecord?.id
    if (!targetRecordId) return
    setAiTagLoading(true)
    setAiTagError('')
    setAiTagMessage('')
    try {
      const response = await fetch(`/api/medical-records/${targetRecordId}/ai-tags`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'retry' ? 'retry' : 'queue',
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'AIタグ解析の受付に失敗しました。')
      }
      setAiTagStatus('queued')
      setAiTagSource('rule_based_v1')
      setAiTagMessage(payload?.message ?? 'AIタグ解析を受け付けました。')
      router.refresh()
    } catch (error) {
      setAiTagError(error instanceof Error ? error.message : 'AIタグ解析の受付に失敗しました。')
    } finally {
      setAiTagLoading(false)
    }
  }

  const handleSendLineShare = async () => {
    if (!savedRecordId) return
    setLineSending(true)
    setLineError('')
    setLineMessage('')
    try {
      const response = await fetch(`/api/medical-records/${savedRecordId}/share-line`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'LINE送信に失敗しました。')
      }
      setLineMessage('LINEへ写真カルテを送信しました。')
    } catch (error) {
      setLineError(error instanceof Error ? error.message : 'LINE送信に失敗しました。')
    } finally {
      setLineSending(false)
    }
  }

  const updatePhoto = (
    index: number,
    updater: (photo: MedicalRecordPhotoDraft) => MedicalRecordPhotoDraft
  ) => {
    setPhotos((prev) =>
      prev.map((photo, currentIndex) => {
        if (currentIndex !== index) return photo
        return {
          ...updater(photo),
          sortOrder: currentIndex,
        }
      })
    )
  }

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next.map((photo, currentIndex) => ({
        ...photo,
        sortOrder: currentIndex,
      }))
    })
  }

  const canShare = savedStatus === 'finalized' && Boolean(savedRecordId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded border bg-white p-3">
        <p className="text-sm text-gray-600">カルテ入力はモーダルで行います。</p>
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)}>
            カルテモーダルを開く
          </Button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="flex max-h-[100vh] min-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:min-h-0 md:max-h-[92vh] md:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-4 md:px-5">
              <h3 className="text-lg font-semibold text-gray-900">
                {editRecord ? 'カルテ情報の更新' : '新規カルテ登録'}
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>

            <form action={formAction} method="post" className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              {editRecord && <input type="hidden" name="_method" value="put" />}
              <input type="hidden" name="appointment_id" value={linkedAppointmentId} />
              <input type="hidden" name="tags" value={tagInput} />
              <input
                type="hidden"
                name="photo_payload"
                value={JSON.stringify(
                  photos.map((photo, index) => ({
                    id: photo.id,
                    photoType: photo.photoType,
                    storagePath: photo.storagePath,
                    comment: photo.comment,
                    sortOrder: index,
                    takenAt: photo.takenAt,
                  }))
                )}
              />
              <input
                type="hidden"
                name="video_payload"
                value={JSON.stringify(
                  videos.map((video, index) => ({
                    id: video.id,
                    storagePath: video.storagePath,
                    thumbnailPath: video.thumbnailPath,
                    lineShortPath: video.lineShortPath,
                    durationSec: video.durationSec,
                    sizeBytes: video.sizeBytes,
                    sourceType: video.sourceType,
                    comment: video.comment,
                    sortOrder: index,
                    takenAt: video.takenAt,
                  }))
                )}
              />

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 md:px-5">
                {linkedAppointmentId || linkedPaymentId ? (
                  <section className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p>紐づけ予約ID: {linkedAppointmentId || '未設定'}</p>
                      <p>紐づけ会計ID: {linkedPaymentId || '未設定'}</p>
                    </div>
                    {linkedAppointmentSummary ? (
                      <div className="grid gap-2 text-xs md:grid-cols-2">
                        <p>施術日時: {formatDateTimeJst(linkedAppointmentSummary.start_time)}</p>
                        <p>担当スタッフ: {linkedAppointmentSummary.staff_name ?? '未設定'}</p>
                        <p>施術メニュー: {linkedAppointmentSummary.menu ?? '未設定'}</p>
                        <p>
                          所要時間:{' '}
                          {linkedAppointmentSummary.duration ? `${linkedAppointmentSummary.duration} 分` : '未設定'}
                        </p>
                      </div>
                    ) : null}
                    {linkedCustomerSummary ? (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <p>顧客: {linkedCustomerSummary.full_name ?? '未設定'}</p>
                        <p>LINE連携: {linkedCustomerSummary.hasLineId ? 'あり' : 'なし'}</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {saveMessage ? (
                  <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {saveMessage}
                  </div>
                ) : null}
                {saveError ? (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    ペット
                    <select
                      name="pet_id"
                      required
                      defaultValue={defaultPetId}
                      onChange={(event) => setPetId(event.target.value)}
                      className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="" disabled>
                        選択してください
                      </option>
                      {petOptions.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    担当スタッフ
                    <select
                      name="staff_id"
                      required
                      defaultValue={defaultStaffId}
                      className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="" disabled>
                        選択してください
                      </option>
                      {staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    施術日時
                    <Input
                      type="datetime-local"
                      name="record_date"
                      required
                      defaultValue={recordDate}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setRecordDate(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    カルテ状態
                    <select
                      name="status"
                      defaultValue={defaultStatus}
                      className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="draft">下書き</option>
                      <option value="finalized">確定</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    施術メニュー
                    <Input name="menu" required defaultValue={defaultMenu} placeholder="シャンプー + カット" />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    会計
                    <select
                      name="payment_id"
                      defaultValue={linkedPaymentId}
                      className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                      disabled={!linkedAppointmentId}
                    >
                      <option value="">自動選択 / 未選択</option>
                      {paymentOptions.map((payment) => (
                        <option key={payment.id} value={payment.id}>
                          {payment.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    所要時間 (分)
                    <Input type="number" name="duration" defaultValue={defaultDuration} placeholder="90" />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    使用シャンプー
                    <Input name="shampoo_used" defaultValue={editRecord?.shampoo_used ?? ''} placeholder="低刺激シャンプー" />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    皮膚状態
                    <Input name="skin_condition" defaultValue={editRecord?.skin_condition ?? ''} placeholder="乾燥気味" />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    問題行動
                    <Input name="behavior_notes" defaultValue={editRecord?.behavior_notes ?? ''} placeholder="噛み癖あり" />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                    注意事項
                    <Input name="caution_notes" defaultValue={editRecord?.caution_notes ?? ''} placeholder="高齢犬、持病など" />
                  </label>
                </div>

                <section className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-violet-950">AIタグ</h4>
                        <p className="text-xs text-violet-900">
                          写真コメントとカルテ内容からタグ候補を非同期で付与します。必要に応じて手動修正できます。
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${getMedicalRecordAiTagStatusTone(aiTagStatus)}`}
                      >
                        {getMedicalRecordAiTagStatusLabel(aiTagStatus)}
                      </span>
                    </div>
                    <label className="space-y-2 text-xs text-gray-700">
                      タグ
                      <textarea
                        value={tagInput}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTagInput(event.target.value)}
                        rows={3}
                        className="w-full rounded border bg-white p-2 outline-none focus:ring-2 focus:ring-violet-400"
                        placeholder="毛玉:少, 皮膚状態:正常"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => handleRunAiTagAnalysis(aiTagStatus === 'failed' ? 'retry' : 'queue')}
                        disabled={aiTagLoading || !(savedRecordId || editRecord?.id)}
                        className="min-h-11 bg-violet-700 text-sm hover:bg-violet-800"
                      >
                        {aiTagLoading ? '受付中...' : aiTagStatus === 'failed' ? 'AIタグを再解析' : 'AIタグを解析'}
                      </Button>
                      {!(savedRecordId || editRecord?.id) ? (
                        <p className="text-xs text-amber-700">カルテ保存後にAIタグ解析を開始できます。</p>
                      ) : null}
                    </div>
                    <div className="grid gap-1 text-xs text-violet-900">
                      <p>最終解析: {aiTagLastAnalyzedAt ? formatDateTimeJst(aiTagLastAnalyzedAt) : '未実行'}</p>
                      <p>プロバイダ: {aiTagSource || '未設定'}</p>
                    </div>
                    {splitTagInput(tagInput).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {splitTagInput(tagInput).map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2 py-1 text-xs font-medium text-violet-900">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {aiTagMessage ? <p className="text-xs text-emerald-700">{aiTagMessage}</p> : null}
                    {aiTagError ? <p className="text-xs text-red-600">{aiTagError}</p> : null}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">写真カルテ</h4>
                      <p className="text-xs text-gray-500">現場向けに撮影導線を優先しています。コメント入力はあとからでも大丈夫です。</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={() => beforeInputRef.current?.click()}
                        disabled={uploading}
                        className="min-h-11 bg-sky-600 text-sm hover:bg-sky-700"
                      >
                        {uploading ? 'アップロード中...' : '施術前を撮る'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => afterInputRef.current?.click()}
                        disabled={uploading}
                        className="min-h-11 bg-emerald-600 text-sm hover:bg-emerald-700"
                      >
                        {uploading ? 'アップロード中...' : '施術後を撮る'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
                      <Button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={videoUploading}
                        className="min-h-11 bg-indigo-600 text-sm hover:bg-indigo-700"
                      >
                        {videoUploading ? 'アップロード中...' : '施術動画を撮る'}
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={beforeInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(event) => handleUploadPhotos(event, 'before')}
                    disabled={uploading}
                    className="hidden"
                  />
                  <input
                    ref={afterInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(event) => handleUploadPhotos(event, 'after')}
                    disabled={uploading}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    multiple
                    onChange={handleUploadVideos}
                    disabled={videoUploading}
                    className="hidden"
                  />
                  {!petId || !recordDate ? (
                    <p className="text-xs text-amber-700">写真アップロードにはペットと施術日時の入力が必要です。</p>
                  ) : null}
                  {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
                  {videoUploadError ? <p className="text-xs text-red-600">{videoUploadError}</p> : null}
                  {photos.length > 0 ? (
                    <div className="space-y-3">
                      {photos.map((photo, index) => (
                        <div key={`${photo.storagePath}-${index}`} className="grid gap-3 rounded border p-3 md:grid-cols-[160px_1fr]">
                          <div className="relative h-40 overflow-hidden rounded border bg-slate-50">
                            {photo.signedUrl ? (
                              <Image
                                src={photo.signedUrl}
                                alt={`カルテ写真 ${index + 1}`}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-40 items-center justify-center text-xs text-gray-500">プレビューなし</div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-2 text-xs text-gray-700">
                                種別
                                <select
                                  value={photo.photoType}
                                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                    updatePhoto(index, (current) => ({
                                      ...current,
                                      photoType: event.target.value === 'after' ? 'after' : 'before',
                                    }))
                                  }
                                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                  <option value="before">施術前</option>
                                  <option value="after">施術後</option>
                                </select>
                              </label>
                              <label className="space-y-2 text-xs text-gray-700">
                                撮影日時
                                <Input
                                  type="datetime-local"
                                  value={toDateTimeLocalValue(photo.takenAt)}
                                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                    updatePhoto(index, (current) => ({
                                      ...current,
                                      takenAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <label className="space-y-2 text-xs text-gray-700">
                              コメント
                              <textarea
                                value={photo.comment}
                                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                                  updatePhoto(index, (current) => ({
                                    ...current,
                                    comment: event.target.value,
                                  }))
                                }
                                rows={3}
                                className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="皮膚の状態や仕上がりメモを入力"
                              />
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => movePhoto(index, -1)}
                                className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                前へ
                              </button>
                              <button
                                type="button"
                                onClick={() => movePhoto(index, 1)}
                                className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                次へ
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhotos((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                                className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">写真はまだ登録されていません。</p>
                  )}

                  {videos.length > 0 ? (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-semibold text-gray-900">登録済み動画</p>
                      {videos.map((video, index) => (
                        <div key={`${video.storagePath}-${index}`} className="rounded border p-3">
                          <div className="space-y-2 text-xs text-gray-700">
                            <p>動画 {index + 1}</p>
                            {video.signedUrl ? (
                              <video src={video.signedUrl} controls preload="metadata" className="w-full rounded" />
                            ) : (
                              <p className="text-gray-500">プレビューなし</p>
                            )}
                            <label className="space-y-1 text-xs text-gray-700 block">
                              コメント
                              <textarea
                                value={video.comment}
                                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                                  setVideos((prev) =>
                                    prev.map((current, currentIndex) =>
                                      currentIndex === index
                                        ? { ...current, comment: event.target.value, sortOrder: currentIndex }
                                        : current
                                    )
                                  )
                                }
                                rows={2}
                                className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="動画メモを入力"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setVideos((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                              className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              動画を削除
                            </button>
                            {video.id ? (
                              <MedicalRecordVideoThumbnailButton
                                videoId={video.id}
                                hasThumbnail={Boolean(video.thumbnailPath)}
                              />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">動画はまだ登録されていません。</p>
                  )}
                </section>

                {galleryEntries.length > 0 ? (
                  <section className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">時系列ギャラリー</h4>
                      <p className="text-xs text-gray-500">同じペットの過去写真を来店順に確認できます。</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {galleryEntries.map((entry) => (
                        <article key={entry.id} className="overflow-hidden rounded border">
                          <div className="relative aspect-[4/3] bg-slate-50">
                            {entry.signedUrl ? (
                              <Image src={entry.signedUrl} alt="過去カルテ写真" fill className="object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-gray-500">画像なし</div>
                            )}
                          </div>
                          <div className="space-y-1 p-3 text-xs text-gray-700">
                            <p className="font-semibold text-gray-900">
                              {entry.photoType === 'before' ? '施術前' : '施術後'}
                            </p>
                            <p>来店日: {formatDateTimeJst(entry.recordDate)}</p>
                            <p>撮影日時: {formatDateTimeJst(entry.takenAt)}</p>
                            <p>メニュー: {entry.menu ?? '未設定'}</p>
                            <p>コメント: {entry.comment || '未入力'}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {canShare ? (
                  <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-950">保存後の共有</h4>
                      <p className="text-xs text-emerald-800">保存したまま顧客共有まで続けて進められます。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleCreateShare}
                        disabled={shareLoading}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {shareLoading ? 'URL発行中...' : 'URLコピー'}
                      </Button>
                      {linkedCustomerSummary?.hasLineId ? (
                        <Button
                          type="button"
                          onClick={handleSendLineShare}
                          disabled={lineSending}
                          className="bg-slate-900 hover:bg-slate-800"
                        >
                          {lineSending ? 'LINE送信中...' : 'LINE送信'}
                        </Button>
                      ) : (
                        <p className="text-xs text-amber-700">顧客に `line_id` がないためLINE送信は使えません。</p>
                      )}
                    </div>
                    {shareUrl ? (
                      <div className="rounded border border-emerald-200 bg-white p-2 text-xs text-emerald-900">
                        <p>7日間有効のURLを発行しました。クリップボードへコピー済みです。</p>
                        <a href={shareUrl} target="_blank" rel="noreferrer" className="break-all underline">
                          {shareUrl}
                        </a>
                      </div>
                    ) : null}
                    {shareError ? <p className="text-xs text-red-600">{shareError}</p> : null}
                    {lineMessage ? <p className="text-xs text-emerald-800">{lineMessage}</p> : null}
                    {lineError ? <p className="text-xs text-red-600">{lineError}</p> : null}
                  </section>
                ) : null}
              </div>

              <div className="sticky bottom-0 border-t bg-white px-4 py-3 md:px-5">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-sm text-gray-500"
                  >
                    入力をやめる
                  </button>
                  <Button type="submit" disabled={saving}>
                    {saving ? '保存中...' : editRecord ? '更新する' : '登録する'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
