'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'
import type {
  MedicalRecordPhotoDraft,
  MedicalRecordPhotoType,
} from '@/lib/medical-records/photos'

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
}

type LinkedAppointmentSummary = {
  id: string
  start_time: string | null
  menu: string | null
  duration: number | null
  staff_name: string | null
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
  paymentOptions: PaymentOption[]
  defaultPetId: string
  defaultStaffId: string
  defaultRecordDate: string
  defaultMenu: string
  defaultDuration: string
  defaultStatus?: 'draft' | 'finalized'
  closeRedirectTo?: string
  photoEntries?: MedicalRecordPhotoDraft[]
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

export function MedicalRecordCreateModal({
  editRecord,
  petOptions,
  staffOptions,
  formAction,
  linkedAppointmentId,
  linkedPaymentId,
  linkedAppointmentSummary,
  paymentOptions,
  defaultPetId,
  defaultStaffId,
  defaultRecordDate,
  defaultMenu,
  defaultDuration,
  defaultStatus = 'draft',
  closeRedirectTo = '/medical-records?tab=list',
  photoEntries = [],
  galleryEntries = [],
}: MedicalRecordCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [petId, setPetId] = useState(defaultPetId)
  const [recordDate, setRecordDate] = useState(toDateTimeLocalValue(defaultRecordDate))
  const [batchPhotoType, setBatchPhotoType] = useState<MedicalRecordPhotoType>('before')
  const [photos, setPhotos] = useState<MedicalRecordPhotoDraft[]>(photoEntries)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

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

  const handleUploadPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
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
        formData.append('photoType', batchPhotoType)
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
            photoType: batchPhotoType,
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

  const updatePhoto = (index: number, updater: (photo: MedicalRecordPhotoDraft) => MedicalRecordPhotoDraft) => {
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
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

            <form action={formAction} method="post" className="space-y-6">
              {editRecord && <input type="hidden" name="_method" value="put" />}
              <input type="hidden" name="appointment_id" value={linkedAppointmentId} />
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

              {linkedAppointmentId || linkedPaymentId ? (
                <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                  <p>紐づけ予約ID: {linkedAppointmentId || '未設定'}</p>
                  <p>紐づけ会計ID: {linkedPaymentId || '未設定'}</p>
                  {linkedAppointmentSummary ? (
                    <div className="mt-2 space-y-1">
                      <p>施術日時: {formatDateTimeJst(linkedAppointmentSummary.start_time)}</p>
                      <p>担当スタッフ: {linkedAppointmentSummary.staff_name ?? '未設定'}</p>
                      <p>施術メニュー: {linkedAppointmentSummary.menu ?? '未設定'}</p>
                      <p>
                        所要時間:{' '}
                        {linkedAppointmentSummary.duration ? `${linkedAppointmentSummary.duration} 分` : '未設定'}
                      </p>
                    </div>
                  ) : null}
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

              <section className="space-y-3 rounded border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">写真カルテ</h4>
                    <p className="text-xs text-gray-500">施術前後で自動整理されます。コメントは写真ごとに保存されます。</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr]">
                    <label className="space-y-2 text-xs text-gray-700">
                      アップロード分類
                      <select
                        value={batchPhotoType}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setBatchPhotoType(event.target.value === 'after' ? 'after' : 'before')
                        }
                        className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="before">施術前</option>
                        <option value="after">施術後</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-xs text-gray-700">
                      写真追加
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUploadPhotos}
                        disabled={uploading}
                        className="block w-full rounded border bg-white p-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
                {!petId || !recordDate ? (
                  <p className="text-xs text-amber-700">写真アップロードにはペットと施術日時の入力が必要です。</p>
                ) : null}
                {uploading ? <p className="text-xs text-gray-500">アップロード中...</p> : null}
                {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
                {photos.length > 0 ? (
                  <div className="space-y-3">
                    {photos.map((photo, index) => (
                      <div key={`${photo.storagePath}-${index}`} className="grid gap-3 rounded border p-3 md:grid-cols-[160px_1fr]">
                        <div className="overflow-hidden rounded border bg-slate-50">
                          {photo.signedUrl ? (
                            <img
                              src={photo.signedUrl}
                              alt={`カルテ写真 ${index + 1}`}
                              className="h-40 w-full object-cover"
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
              </section>

              {galleryEntries.length > 0 ? (
                <section className="space-y-3 rounded border border-slate-200 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">時系列ギャラリー</h4>
                    <p className="text-xs text-gray-500">同じペットの過去写真を来店順に確認できます。</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {galleryEntries.map((entry) => (
                      <article key={entry.id} className="overflow-hidden rounded border">
                        <div className="aspect-[4/3] bg-slate-50">
                          {entry.signedUrl ? (
                            <img src={entry.signedUrl} alt="過去カルテ写真" className="h-full w-full object-cover" />
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

              <div className="flex items-center gap-2">
                <Button type="submit">{editRecord ? '更新する' : '登録する'}</Button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-sm text-gray-500"
                >
                  入力をやめる
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
