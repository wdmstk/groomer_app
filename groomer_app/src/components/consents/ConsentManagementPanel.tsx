'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatConsentDateJst, renderConsentTemplateHtml } from '@/lib/consents/template-render'

type CustomerOption = {
  id: string
  label: string
  address?: string | null
  phone_number?: string | null
}
type PetOption = {
  id: string
  customer_id: string
  label: string
  breed?: string | null
  age?: string | null
  gender?: string | null
}
type TemplateRow = {
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
}
type DocumentRow = {
  id: string
  customer_id: string
  pet_id: string
  appointment_id?: string | null
  status: string
  signed_at: string | null
  created_at: string
  pdf_path?: string | null
}

type TabId = 'create-template' | 'publish-version' | 'create-document' | 'history'
type ConsentMode = 'all' | 'customer-ops' | 'store-admin'

type Props = {
  templates: TemplateRow[]
  documents: DocumentRow[]
  storeName: string
  customers: CustomerOption[]
  pets: PetOption[]
  initialAppointmentId?: string
  initialDocCustomerId?: string
  initialDocPetId?: string
  initialServiceName?: string
  initialTab?: string
  initialMode?: string
}

const allowedTabs: TabId[] = ['create-template', 'publish-version', 'create-document', 'history']

function resolveMode(value: string | undefined): ConsentMode {
  if (value === 'customer-ops' || value === 'store-admin') return value
  return 'all'
}

function getAllowedTabsByMode(mode: ConsentMode): TabId[] {
  if (mode === 'customer-ops') return ['create-document', 'history']
  if (mode === 'store-admin') return ['create-template', 'publish-version']
  return allowedTabs
}

function resolveTab(value: string | undefined, mode: ConsentMode): TabId {
  const allowed = getAllowedTabsByMode(mode)
  if (value && allowed.includes(value as TabId)) {
    return value as TabId
  }
  return mode === 'store-admin' ? 'create-template' : 'create-document'
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeBodyText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function bodyTextToHtml(value: string) {
  const normalized = normalizeBodyText(value)
  if (!normalized) return '<p></p>'
  return normalized
    .split('\n\n')
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
    .join('\n')
}

export function ConsentManagementPanel({
  templates: initialTemplates,
  documents: initialDocuments,
  storeName,
  customers,
  pets,
  initialAppointmentId = '',
  initialDocCustomerId = '',
  initialDocPetId = '',
  initialServiceName = '',
  initialTab,
  initialMode,
}: Props) {
  const router = useRouter()
  const mode = resolveMode(initialMode)
  const modeAllowedTabs = getAllowedTabsByMode(mode)
  const [templates, setTemplates] = useState(initialTemplates)
  const [documents, setDocuments] = useState(initialDocuments)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('grooming')
  const [versionTemplateId, setVersionTemplateId] = useState('')
  const [versionTitle, setVersionTitle] = useState('')
  const [versionBody, setVersionBody] = useState('施術前に注意事項をご確認ください。')
  const [docTemplateId, setDocTemplateId] = useState('')
  const [docCustomerId, setDocCustomerId] = useState(initialDocCustomerId)
  const [docPetId, setDocPetId] = useState(initialDocPetId)
  const appointmentId = initialAppointmentId
  const [serviceName, setServiceName] = useState(initialServiceName)
  const [docChannel, setDocChannel] = useState<'in_person' | 'line'>('in_person')
  const [resendingDocumentId, setResendingDocumentId] = useState<string | null>(null)
  const [pdfLoadingDocumentId, setPdfLoadingDocumentId] = useState<string | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [signUrlByDocumentId, setSignUrlByDocumentId] = useState<Record<string, string>>({})
  const activeTab = resolveTab(initialTab, mode)
  const showStoreAdminCombined = mode === 'store-admin'

  const filteredPets = useMemo(() => {
    if (!docCustomerId) return pets
    return pets.filter((pet) => pet.customer_id === docCustomerId)
  }, [docCustomerId, pets])

  const selectedTemplate = useMemo(() => templates.find((row) => row.id === docTemplateId) ?? null, [docTemplateId, templates])
  const selectedCustomer = useMemo(() => customers.find((row) => row.id === docCustomerId) ?? null, [customers, docCustomerId])
  const selectedPet = useMemo(() => pets.find((row) => row.id === docPetId) ?? null, [docPetId, pets])

  const renderedPreviewHtml = useMemo(() => {
    const rawHtml = selectedTemplate?.current_version?.body_html
    if (!rawHtml) return ''
    return renderConsentTemplateHtml(rawHtml, {
      store_name: storeName,
      customer_name: selectedCustomer?.label ?? 'ー',
      pet_name: selectedPet?.label ?? 'ー',
      service_name: serviceName,
      customer_address: selectedCustomer?.address ?? 'ー',
      customer_phone: selectedCustomer?.phone_number ?? 'ー',
      pet_species: 'ー',
      pet_breed: selectedPet?.breed ?? 'ー',
      pet_age: selectedPet?.age ?? 'ー',
      pet_gender: selectedPet?.gender ?? 'ー',
      consent_date: formatConsentDateJst(),
    })
  }, [
    selectedCustomer?.address,
    selectedCustomer?.label,
    selectedCustomer?.phone_number,
    selectedPet?.age,
    selectedPet?.breed,
    selectedPet?.gender,
    selectedPet?.label,
    selectedTemplate?.current_version?.body_html,
    serviceName,
    storeName,
  ])

  useEffect(() => {
    if (!versionTemplateId) return
    const template = templates.find((row) => row.id === versionTemplateId)
    const templateBody = template?.current_version?.body_text
    setVersionBody(normalizeBodyText(templateBody && templateBody.trim() ? templateBody : '施術前に注意事項をご確認ください。'))
  }, [templates, versionTemplateId])

  async function refreshDocuments() {
    const params = new URLSearchParams()
    if (initialDocCustomerId) params.set('customer_id', initialDocCustomerId)
    if (initialDocPetId) params.set('pet_id', initialDocPetId)
    const path = params.toString() ? `/api/consents/documents?${params.toString()}` : '/api/consents/documents'
    const response = await fetch(path, { cache: 'no-store' })
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
    const normalizedBody = normalizeBodyText(versionBody)
    if (!versionTemplateId || !normalizedBody) {
      setError('文面を入力してから有効化してください。')
      return
    }
    const selectedVersionTemplate = templates.find((row) => row.id === versionTemplateId)
    const resolvedTitle = versionTitle.trim() || `${selectedVersionTemplate?.name ?? '同意書'} 初版`
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/consents/templates/${versionTemplateId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolvedTitle,
          body_html: bodyTextToHtml(normalizedBody),
          body_text: normalizedBody,
          publish: true,
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? '版公開に失敗しました。')
      await refreshTemplates()
      setVersionTitle('')
      setMessage('同意文を有効化しました。')
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
          appointment_id: appointmentId || null,
          customer_id: docCustomerId,
          pet_id: docPetId,
          delivery_channel: docChannel,
          service_name: serviceName.trim() || null,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        message?: string
        sign_url?: string
        document?: { id?: string }
      } | null
      if (!response.ok) throw new Error(body?.message ?? '同意書作成に失敗しました。')
      await refreshDocuments()
      if (body?.sign_url && body?.document?.id) {
        setSignUrlByDocumentId((current) => ({ ...current, [body.document?.id as string]: body.sign_url as string }))
      }
      if (docChannel === 'in_person' && body?.sign_url) {
        window.open(body.sign_url, '_blank', 'noopener,noreferrer')
      }
      setMessage(docChannel === 'line' ? '同意書を作成し、LINE送信しました。' : '同意書を作成しました。署名画面を別タブで開きました。')
      if (modeAllowedTabs.includes('history')) {
        router.push(buildTabHref('history'))
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '同意書作成に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function regenerateSignUrl(documentId: string) {
    setResendingDocumentId(documentId)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/consents/documents/${documentId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'in_person',
          service_name: serviceName.trim() || null,
          appointment_id: appointmentId || null,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        message?: string
        sign_url?: string
        status?: 'sent' | 'failed'
      } | null
      if (!response.ok) throw new Error(body?.message ?? '署名URLの再発行に失敗しました。')

      if (body?.sign_url) {
        setSignUrlByDocumentId((current) => ({ ...current, [documentId]: body.sign_url as string }))
      }
      await refreshDocuments()
      setMessage('署名URLを再発行しました。')
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : '署名URLの再発行に失敗しました。')
    } finally {
      setResendingDocumentId(null)
    }
  }

  async function openPdf(documentId: string) {
    setPdfLoadingDocumentId(documentId)
    setError(null)
    try {
      const response = await fetch(`/api/consents/documents/${documentId}/pdf`, { method: 'GET' })
      const body = (await response.json().catch(() => null)) as { signed_url?: string; message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'PDF参照に失敗しました。')
      if (!body?.signed_url) throw new Error('PDF URLの取得に失敗しました。')
      window.open(body.signed_url, '_blank', 'noopener,noreferrer')
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'PDF参照に失敗しました。')
    } finally {
      setPdfLoadingDocumentId(null)
    }
  }

  async function deleteDocument(documentId: string) {
    const shouldDelete = window.confirm('この同意書履歴を削除します。よろしいですか？')
    if (!shouldDelete) return

    setDeletingDocumentId(documentId)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/consents/documents/${documentId}`, {
        method: 'DELETE',
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? '同意書の削除に失敗しました。')
      await refreshDocuments()
      setSignUrlByDocumentId((current) => {
        const next = { ...current }
        delete next[documentId]
        return next
      })
      setMessage('同意書履歴を削除しました。')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '同意書の削除に失敗しました。')
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const visibleTabs: Array<{ id: TabId; label: string }> =
    mode === 'store-admin'
      ? []
      : mode === 'customer-ops'
        ? [
            { id: 'create-document', label: '同意書を作成・署名依頼' },
            { id: 'history', label: '同意書履歴' },
          ]
        : [
            { id: 'create-template', label: 'テンプレ作成' },
            { id: 'publish-version', label: '同意文を有効化' },
            { id: 'create-document', label: '同意書を作成・署名依頼' },
            { id: 'history', label: '同意書履歴' },
          ]

  function buildTabHref(tab: TabId) {
    const params = new URLSearchParams()
    params.set('mode', mode)
    params.set('tab', tab)
    if (appointmentId) params.set('appointment_id', appointmentId)
    if (initialDocCustomerId) params.set('customer_id', initialDocCustomerId)
    if (initialDocPetId) params.set('pet_id', initialDocPetId)
    if (initialServiceName) params.set('service_name', initialServiceName)
    return `/consents?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {message ? <p data-testid="consent-message" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p data-testid="consent-error" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {visibleTabs.length > 0 ? (
        <div className="flex items-center gap-4 border-b">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={buildTabHref(tab.id)}
              className={`pb-2 text-sm font-semibold ${
                activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      ) : null}

      {showStoreAdminCombined || activeTab === 'create-template' ? (
        <section className="rounded border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">テンプレートを作成</h2>
          <p className="mt-1 text-sm text-gray-600">テンプレート名は「何の同意書か」を識別するための名前です（例: 施術同意書 標準）。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input className="rounded border px-3 py-2 text-sm" placeholder="テンプレート名" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <select className="rounded border px-3 py-2 text-sm" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}>
              <option value="grooming">施術（grooming）</option>
              <option value="hotel">ホテル（hotel）</option>
              <option value="medical">医療/注意（medical）</option>
            </select>
            <button type="button" onClick={() => void createTemplate()} disabled={submitting} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">
              テンプレート作成
            </button>
          </div>
        </section>
      ) : null}

      {showStoreAdminCombined || activeTab === 'publish-version' ? (
        <section className="rounded border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">同意文を有効化</h2>
          <p className="mt-1 text-sm text-gray-600">文面を変えるたびに新しい版として有効化します。</p>
          <div className="mt-3 space-y-3">
            <select className="w-full rounded border px-3 py-2 text-sm" value={versionTemplateId} onChange={(e) => setVersionTemplateId(e.target.value)}>
              <option value="">テンプレートを選択</option>
              {templates.map((row) => (
                <option key={row.id} value={row.id}>{row.name} ({row.status})</option>
              ))}
            </select>
            <input className="w-full rounded border px-3 py-2 text-sm" placeholder="版名（任意。未入力なら「初版」）" value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} />
            <textarea
              className="min-h-32 w-full rounded border px-3 py-2 text-sm"
              placeholder="同意文をそのまま入力してください（通常入力のみでOK）"
              value={versionBody}
              onChange={(e) => setVersionBody(e.target.value)}
            />
            <button type="button" onClick={() => void publishVersion()} disabled={submitting} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300">
              この文面を有効化
            </button>
            <p className="text-xs text-gray-500">内部でHTML本文/本文プレーンテキストへ自動変換して保存します。</p>
          </div>
        </section>
      ) : null}

      {activeTab === 'create-document' ? (
        <section className="rounded border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">同意書を作成・署名依頼</h2>
          {appointmentId ? (
            <p className="mt-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              予約起点プリセット適用中（予約ID: {appointmentId}）
            </p>
          ) : null}
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
            <input
              className="rounded border px-3 py-2 text-sm md:col-span-2"
              placeholder="希望施術内容（例: シャンプー + カット）"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </div>
          <button data-testid="consent-doc-submit" type="button" onClick={() => void createDocument()} disabled={submitting} className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300">
            同意書を作成
          </button>
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-800">本文プレビュー（差し込み後）</p>
            {renderedPreviewHtml ? (
              <div
                className="prose prose-sm mt-2 max-w-none rounded bg-white p-3"
                dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
              />
            ) : (
              <p className="mt-2 text-xs text-gray-500">テンプレートを選択すると本文が表示されます。</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="rounded border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">同意書履歴</h2>
          {documents.length === 0 ? <p className="mt-2 text-sm text-gray-500">同意書がまだ作成されていません。</p> : null}
          {documents.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="px-2 py-2">同意書ID</th>
                    <th className="px-2 py-2">予約ID</th>
                    <th className="px-2 py-2">ステータス</th>
                    <th className="px-2 py-2">署名日時</th>
                    <th className="px-2 py-2">作成日時</th>
                    <th className="px-2 py-2">PDF</th>
                    <th className="px-2 py-2">署名URL</th>
                    <th className="px-2 py-2">削除</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2 py-2 font-mono text-xs">{row.id}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.appointment_id ?? '-'}</td>
                      <td className="px-2 py-2">{row.status}</td>
                      <td className="px-2 py-2">{formatDate(row.signed_at)}</td>
                      <td className="px-2 py-2">{formatDate(row.created_at)}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void openPdf(row.id)}
                          disabled={pdfLoadingDocumentId === row.id || !row.pdf_path}
                          className="rounded border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                        >
                          {pdfLoadingDocumentId === row.id ? '取得中...' : 'PDFを開く'}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => void regenerateSignUrl(row.id)}
                            disabled={resendingDocumentId === row.id || row.status === 'signed' || row.status === 'revoked'}
                            className="rounded border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                          >
                            {resendingDocumentId === row.id ? '再発行中...' : '署名URLを再発行'}
                          </button>
                          {signUrlByDocumentId[row.id] ? (
                            <code className="break-all rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-700">
                              {signUrlByDocumentId[row.id]}
                            </code>
                          ) : (
                            <p className="text-[11px] text-gray-500">未表示（再発行で表示）</p>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void deleteDocument(row.id)}
                          disabled={deletingDocumentId === row.id}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                        >
                          {deletingDocumentId === row.id ? '削除中...' : '削除'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
