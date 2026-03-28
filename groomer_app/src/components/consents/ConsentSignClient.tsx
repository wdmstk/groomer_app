'use client'

import { useEffect, useRef, useState } from 'react'

type ConsentSignClientProps = {
  token: string
  serviceName?: string
  appointmentId?: string
}

type ConsentPayload = {
  document?: { id?: string; status?: string; expires_at?: string | null }
  template_version?: { title?: string; body_html?: string; version_no?: number }
  customer?: { full_name?: string }
  pet?: { name?: string }
}

export function ConsentSignClient({ token, serviceName = '', appointmentId = '' }: ConsentSignClientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [payload, setPayload] = useState<ConsentPayload | null>(null)

  useEffect(() => {
    let active = true
    const queryParams = new URLSearchParams()
    if (serviceName.trim()) queryParams.set('service_name', serviceName.trim())
    if (appointmentId.trim()) queryParams.set('appointment_id', appointmentId.trim())
    const query = queryParams.toString() ? `?${queryParams.toString()}` : ''
    async function load() {
      try {
        const response = await fetch(`/api/public/consents/${token}${query}`, { cache: 'no-store' })
        const body = (await response.json().catch(() => null)) as ConsentPayload & { message?: string }
        if (!response.ok) throw new Error(body?.message ?? '同意書を読み込めませんでした。')
        if (!active) return
        setPayload(body)
        setSignerName(body.customer?.full_name ?? '')
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : '同意書を読み込めませんでした。')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [appointmentId, serviceName, token])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineWidth = 2
    context.strokeStyle = '#111827'
    context.lineCap = 'round'
    context.lineJoin = 'round'
  }, [])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const point = getPoint(event)
    drawingRef.current = true
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function submit() {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!signerName.trim()) {
      setError('署名者名を入力してください。')
      return
    }
    if (!agreed) {
      setError('同意チェックを有効にしてください。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const queryParams = new URLSearchParams()
      if (serviceName.trim()) queryParams.set('service_name', serviceName.trim())
      if (appointmentId.trim()) queryParams.set('appointment_id', appointmentId.trim())
      const query = queryParams.toString() ? `?${queryParams.toString()}` : ''
      const response = await fetch(`/api/public/consents/${token}/sign${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          consent_checked: true,
          signature_image_base64: canvas.toDataURL('image/png'),
          device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          browser: navigator.userAgent,
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string; pdf_url?: string } | null
      if (!response.ok) throw new Error(body?.message ?? '署名送信に失敗しました。')
      setDone(true)
      setPdfUrl(body?.pdf_url ?? null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '署名送信に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">同意書を読み込み中...</p>
  if (error && !payload) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-gray-600">
          対象: {payload?.customer?.full_name ?? '顧客'} / {payload?.pet?.name ?? 'ペット'}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">
          {payload?.template_version?.title ?? '施術同意書'}
        </h1>
        <p className="text-xs text-gray-500">版: {payload?.template_version?.version_no ?? '-'}</p>
      </div>

      <article className="rounded border bg-white p-4">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: payload?.template_version?.body_html ?? '<p>本文がありません。</p>' }}
        />
      </article>

      <div className="rounded border bg-white p-4 space-y-3">
        <label className="block text-sm text-gray-700">
          署名者名
          <input
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="山田 太郎"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" />
          <span>上記内容を確認し、施術同意書に同意します。</span>
        </label>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-800">手書き署名</p>
          <canvas
            ref={canvasRef}
            width={640}
            height={220}
            className="w-full rounded border bg-white touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          <button type="button" onClick={clearCanvas} className="mt-2 rounded border px-3 py-1 text-sm text-gray-700">
            署名をクリア
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {done ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            署名が完了しました。
            {pdfUrl ? (
              <a href={pdfUrl} className="ml-2 underline" target="_blank" rel="noreferrer">
                PDFを開く
              </a>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || done}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {submitting ? '送信中...' : '署名して送信'}
        </button>
      </div>
    </div>
  )
}
