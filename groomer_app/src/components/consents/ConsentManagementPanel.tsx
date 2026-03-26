'use client'

import { useMemo, useState } from 'react'

type Option = { id: string; label: string; extra?: string | null }
type TemplateRow = {
  id: string
  name: string
  category: string
  status: string
  current_version_id: string | null
}
type DocumentRow = {
  id: string
  customer_id: string
  pet_id: string
  status: string
  signed_at: string | null
  created_at: string
}

type Props = {
  templates: TemplateRow[]
  documents: DocumentRow[]
  customers: Option[]
  pets: Array<Option & { customer_id: string }>
}

function formatDate(value: string | null) {
  if (!value) return '未署名'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未署名'
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

export function ConsentManagementPanel({ templates: initialTemplates, documents: initialDocuments, customers, pets }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [documents, setDocuments] = useState(initialDocuments)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('grooming')
  const [versionTemplateId, setVersionTemplateId] = useState('')
  const [versionTitle, setVersionTitle] = useState('')
  const [versionHtml, setVersionHtml] = useState('<p>施術前に注意事項をご確認ください。</p>')
  const [versionText, setVersionText] = useState('施術前に注意事項をご確認ください。')
  const [docTemplateId, setDocTemplateId] = useState('')
  const [docCustomerId, setDocCustomerId] = useState('')
  const [docPetId, setDocPetId] = useState('')
  const [docChannel, setDocChannel] = useState<'in_person' | 'line'>('in_person')

  const filteredPets = useMemo(() => {
    if (!docCustomerId) return pets
    return pets.filter((pet) => pet.customer_id === docCustomerId)
  }, [docCustomerId, pets])

  async function refreshDocuments() {
    const response = await fetch('/api/consents/documents', { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as { items?: DocumentRow[]; message?: string } | null
    if (!response.ok) throw new Error(body?.message ?? '同意書一覧の更新に失敗しました。')
    setDocuments(body?.items ?? [])
  }

  async function refreshTemplates() {
    const response = await fetch('/api/consents/templates', { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as { items?: TemplateRow[]; message?: string } | null
    if (!response.ok) throw new Error(body?.message ?? 'テンプレート一覧の更新に失敗しました。')
    setTemplates(body?.items ?? [])
  }

  async function createTemplate() {
    if (!templateName.trim()) {
      setError('テンプレート名を入力してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/consents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, category: templateCategory }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'テンプレート作成に失敗しました。')
      await refreshTemplates()
      setTemplateName('')
      setMessage('テンプレートを作成しました。')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'テンプレート作成に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function publishVersion() {
    if (!versionTemplateId || !versionTitle.trim() || !versionHtml.trim() || !versionText.trim()) {
      setError('版公開に必要な項目を入力してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/consents/templates/${versionTemplateId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: versionTitle,
          body_html: versionHtml,
          body_text: versionText,
          publish: true,
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? '版公開に失敗しました。')
      await refreshTemplates()
      setVersionTitle('')
      setMessage('テンプレート版を公開しました。')
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '版公開に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function createDocument() {
    if (!docTemplateId || !docCustomerId || !docPetId) {
      setError('同意書作成に必要な項目を選択してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/consents/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: docTemplateId,
          customer_id: docCustomerId,
          pet_id: docPetId,
          delivery_channel: docChannel,
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string; sign_url?: string } | null
      if (!response.ok) throw new Error(body?.message ?? '同意書作成に失敗しました。')
      await refreshDocuments()
      setMessage(docChannel === 'line' ? '同意書を作成し、LINE送信しました。' : `同意書を作成しました。署名URL: ${body?.sign_url ?? '-'}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '同意書作成に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {message ? <p data-testid="consent-message" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p data-testid="consent-error" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">テンプレート作成</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded border px-3 py-2 text-sm" placeholder="テンプレート名" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          <select className="rounded border px-3 py-2 text-sm" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}>
            <option value="grooming">grooming</option>
            <option value="hotel">hotel</option>
            <option value="medical">medical</option>
          </select>
          <button type="button" onClick={() => void createTemplate()} disabled={submitting} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">
            テンプレート作成
          </button>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">テンプレート版公開</h2>
        <div className="mt-3 space-y-3">
          <select className="w-full rounded border px-3 py-2 text-sm" value={versionTemplateId} onChange={(e) => setVersionTemplateId(e.target.value)}>
            <option value="">テンプレートを選択</option>
            {templates.map((row) => (
              <option key={row.id} value={row.id}>{row.name} ({row.status})</option>
            ))}
          </select>
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="版タイトル" value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} />
          <textarea className="min-h-28 w-full rounded border px-3 py-2 text-sm" placeholder="HTML本文" value={versionHtml} onChange={(e) => setVersionHtml(e.target.value)} />
          <textarea className="min-h-20 w-full rounded border px-3 py-2 text-sm" placeholder="本文プレーンテキスト" value={versionText} onChange={(e) => setVersionText(e.target.value)} />
          <button type="button" onClick={() => void publishVersion()} disabled={submitting} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300">
            版を公開
          </button>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">同意書作成・署名依頼</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select data-testid="consent-doc-template" className="rounded border px-3 py-2 text-sm" value={docTemplateId} onChange={(e) => setDocTemplateId(e.target.value)}>
            <option value="">テンプレートを選択</option>
            {templates.filter((row) => row.current_version_id).map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <select data-testid="consent-doc-customer" className="rounded border px-3 py-2 text-sm" value={docCustomerId} onChange={(e) => { setDocCustomerId(e.target.value); setDocPetId('') }}>
            <option value="">顧客を選択</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select data-testid="consent-doc-pet" className="rounded border px-3 py-2 text-sm" value={docPetId} onChange={(e) => setDocPetId(e.target.value)}>
            <option value="">ペットを選択</option>
            {filteredPets.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select data-testid="consent-doc-channel" className="rounded border px-3 py-2 text-sm" value={docChannel} onChange={(e) => setDocChannel(e.target.value === 'line' ? 'line' : 'in_person')}>
            <option value="in_person">店頭署名</option>
            <option value="line">LINE送信</option>
          </select>
        </div>
        <button data-testid="consent-doc-submit" type="button" onClick={() => void createDocument()} disabled={submitting} className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300">
          同意書を作成
        </button>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">同意書履歴</h2>
        {documents.length === 0 ? <p className="mt-2 text-sm text-gray-500">同意書がまだ作成されていません。</p> : null}
        {documents.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">同意書ID</th>
                  <th className="px-2 py-2">ステータス</th>
                  <th className="px-2 py-2">署名日時</th>
                  <th className="px-2 py-2">作成日時</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 font-mono text-xs">{row.id}</td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="px-2 py-2">{formatDate(row.signed_at)}</td>
                    <td className="px-2 py-2">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
