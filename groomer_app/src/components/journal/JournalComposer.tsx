'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type CustomerOption = {
  id: string
  full_name: string | null
}

type PetOption = {
  id: string
  name: string | null
  customer_id: string | null
}

type JournalComposerProps = {
  customers: CustomerOption[]
  pets: PetOption[]
}

type UploadResponse = {
  storagePath?: string
  signedUrl?: string | null
  error?: string
}

type JournalMediaDraft = {
  media_type: 'photo' | 'video'
  storage_key: string
  thumbnail_key: string | null
  duration_sec: number | null
  preview_url: string | null
}

const QUICK_TEMPLATES = ['シャンプー中も落ち着いています。', 'カット中もとてもお利口さんでした。', 'おやつもしっかり食べて元気です。']

export default function JournalComposer({ customers, pets }: JournalComposerProps) {
  const [customerId, setCustomerId] = useState('')
  const [petIds, setPetIds] = useState<string[]>([])
  const [bodyText, setBodyText] = useState('')
  const [media, setMedia] = useState<JournalMediaDraft[]>([])
  const [publish, setPublish] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const visiblePets = useMemo(() => {
    if (!customerId) return pets
    return pets.filter((pet) => pet.customer_id === customerId)
  }, [customerId, pets])

  function togglePet(petId: string) {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]))
  }

  function applyTemplate(text: string) {
    setBodyText((prev) => (prev.trim().length > 0 ? `${prev}\n${text}` : text))
  }

  async function uploadFiles(kind: 'photo' | 'video', files: FileList | null) {
    if (!files || files.length === 0) return
    if (!customerId || petIds.length === 0) {
      setMessage('先に顧客とペットを選択してください。')
      return
    }

    setUploading(true)
    setMessage(null)
    try {
      const primaryPetId = petIds[0]
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folderPath', `journal/pets/${primaryPetId}/${kind}`)

        const endpoint = kind === 'photo' ? '/api/upload' : '/api/upload/video'
        const res = await fetch(endpoint, { method: 'POST', body: formData })
        const data = (await res.json().catch(() => null)) as UploadResponse | null
        if (!res.ok || !data?.storagePath) {
          throw new Error(data?.error ?? `${kind === 'photo' ? '写真' : '動画'}アップロードに失敗しました。`)
        }

        setMedia((prev) => [
          ...prev,
          {
            media_type: kind,
            storage_key: data.storagePath ?? '',
            thumbnail_key: null,
            duration_sec: null,
            preview_url: data.signedUrl ?? null,
          },
        ])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'アップロードに失敗しました。')
    } finally {
      setUploading(false)
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!customerId || petIds.length === 0) {
      setMessage('顧客とペットを選択してください。')
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/journal/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          pet_ids: petIds,
          body_text: bodyText,
          media: media.map((item) => ({
            media_type: item.media_type,
            storage_key: item.storage_key,
            thumbnail_key: item.thumbnail_key,
            duration_sec: item.duration_sec,
          })),
          publish,
        }),
      })
      const data = (await res.json().catch(() => null)) as { message?: string; status?: string } | null
      if (!res.ok) {
        setMessage(data?.message ?? '日誌の保存に失敗しました。')
        return
      }

      setPetIds([])
      setBodyText('')
      setMedia([])
      setMessage(publish ? '日誌を公開しました。' : '下書きを保存しました。')
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">クイック日誌投稿</h2>
      <p className="mt-1 text-xs text-gray-500">片手操作向けに、顧客選択 → ペット選択 → コメント入力の最短フローです。</p>

      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-700">顧客</span>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value)
              setPetIds([])
            }}
          >
            <option value="">選択してください</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name ?? '名称未設定'}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1 text-sm text-gray-700">ペット（複数選択可）</p>
          <div className="grid grid-cols-2 gap-2">
            {visiblePets.map((pet) => {
              const checked = petIds.includes(pet.id)
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => togglePet(pet.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    checked ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {pet.name ?? '名称未設定'}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm text-gray-700">テンプレート</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900"
              >
                {template}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-gray-700">コメント</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="施術中の様子を入力"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm text-gray-700">写真・動画</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700">
              写真を追加
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading || loading}
                onChange={(event) => {
                  void uploadFiles('photo', event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700">
              動画を追加
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                disabled={uploading || loading}
                onChange={(event) => {
                  void uploadFiles('video', event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>
          {media.length > 0 ? (
            <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-2">
              {media.map((item, index) => (
                <div key={`${item.storage_key}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-gray-700">
                      {item.media_type === 'photo' ? '写真' : '動画'}: {item.storage_key}
                    </p>
                    {item.preview_url ? (
                      item.media_type === 'photo' ? (
                        <div className="relative mt-1 h-12 w-12 overflow-hidden rounded border border-gray-200">
                          <Image src={item.preview_url} alt="日誌写真プレビュー" fill className="object-cover" />
                        </div>
                      ) : (
                        <video
                          src={item.preview_url}
                          className="mt-1 h-12 w-20 rounded border border-gray-200 bg-black"
                          muted
                          playsInline
                        />
                      )
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="rounded border border-red-200 px-2 py-1 text-red-700"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
          公開して通知キューに登録する
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={loading || uploading}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? '保存中...' : uploading ? 'アップロード中...' : publish ? '公開する' : '下書き保存'}
          </button>
          {message ? <p className="text-xs text-gray-600">{message}</p> : null}
        </div>
      </div>
    </section>
  )
}
