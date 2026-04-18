'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type InvoiceRow = {
  id: string
  customer_id: string
  status: string
  subtotal_amount: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  notes?: string | null
  created_at: string
}

type Props = {
  customerNameById: Record<string, string>
}

const paymentMethodOptions = ['現金', 'カード', '電子マネー', 'QR決済', 'その他']

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString()} 円`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
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

export function InvoiceCheckoutPanel({ customerNameById }: Props) {
  const router = useRouter()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [method, setMethod] = useState('現金')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'open' || invoice.status === 'draft'),
    [invoices]
  )

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/invoices', { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { invoices?: InvoiceRow[]; message?: string } | null
      if (!response.ok || !body?.invoices) {
        throw new Error(body?.message ?? '統合請求の取得に失敗しました。')
      }
      setInvoices(body.invoices)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '統合請求の取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  async function submitInvoicePayment(invoiceId: string) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          notes: notes.trim() || null,
          idempotency_key:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `invoice-pay-${Date.now()}-${Math.random()}`,
        }),
      })
      const body = (await response.json().catch(() => null)) as { payment_id?: string; message?: string } | null
      if (!response.ok || !body?.payment_id) {
        throw new Error(body?.message ?? '統合請求の会計確定に失敗しました。')
      }
      router.push(`/receipts/${body.payment_id}`)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '統合請求の会計確定に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">統合請求（β）</p>
          <p className="text-xs text-gray-700">トリミングとホテルの請求をまとめて会計確定できます。</p>
        </div>
        <Button type="button" onClick={() => void loadInvoices()} disabled={loading || submitting}>
          {loading ? '再取得中...' : '再取得'}
        </Button>
      </div>

      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}

      {openInvoices.length === 0 ? (
        <p className="text-sm text-gray-700">会計待ちの統合請求はありません。</p>
      ) : (
        <div className="space-y-2">
          {openInvoices.map((invoice) => {
            const isSelected = selectedInvoiceId === invoice.id
            return (
              <div key={invoice.id} className="rounded border border-emerald-200 bg-white p-3 text-sm text-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">請求ID: {invoice.id}</p>
                    <p>
                      顧客: {customerNameById[invoice.customer_id] ?? invoice.customer_id} / 合計: {formatYen(Number(invoice.total_amount ?? 0))}
                    </p>
                    <p className="text-xs text-gray-500">作成: {formatDateTime(invoice.created_at)}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setSelectedInvoiceId((prev) => (prev === invoice.id ? null : invoice.id))}
                    disabled={submitting}
                  >
                    {isSelected ? '閉じる' : '会計確定'}
                  </Button>
                </div>

                {isSelected ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <label className="text-xs text-gray-700">
                      支払方法
                      <select
                        value={method}
                        onChange={(event) => setMethod(event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {paymentMethodOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-gray-700">
                      備考
                      <input
                        type="text"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="任意"
                      />
                    </label>
                    <Button type="button" onClick={() => void submitInvoicePayment(invoice.id)} disabled={submitting}>
                      {submitting ? '送信中...' : '確定して領収書へ'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
