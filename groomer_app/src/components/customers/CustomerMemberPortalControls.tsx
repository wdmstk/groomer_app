'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type CustomerMemberPortalControlsProps = {
  customerId: string
  customerName: string
  activeExpiresAt?: string | null
  lastUsedAt?: string | null
  compact?: boolean
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未発行'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未発行'
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

export function CustomerMemberPortalControls({
  customerId,
  customerName,
  activeExpiresAt,
  lastUsedAt,
  compact = false,
}: CustomerMemberPortalControlsProps) {
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [portalUrl, setPortalUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState(activeExpiresAt ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleIssue() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/customers/${customerId}/member-portal-link`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as
        | { portalUrl?: string; expiresAt?: string; message?: string }
        | null
      if (!response.ok || !payload?.portalUrl || !payload?.expiresAt) {
        throw new Error(payload?.message ?? `${customerName}様の会員証URL発行に失敗しました。`)
      }
      setPortalUrl(payload.portalUrl)
      setExpiresAt(payload.expiresAt)
      setMessage('会員証URLを発行し、クリップボードへコピーしました。')
      await navigator.clipboard.writeText(payload.portalUrl).catch(() => undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '会員証URL発行に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    setRevoking(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/customers/${customerId}/member-portal-link/revoke`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? `${customerName}様の会員証URL無効化に失敗しました。`)
      }
      setPortalUrl('')
      setExpiresAt('')
      setMessage(payload?.message ?? '会員証URLを無効化しました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '会員証URL無効化に失敗しました。')
    } finally {
      setRevoking(false)
    }
  }

  const hasActiveLink = Boolean(expiresAt)

  return (
    <div className="space-y-2">
      {!compact ? (
        <>
          <p className="text-xs text-gray-500">会員証: {formatDateTimeJst(expiresAt)}</p>
          <p className="text-xs text-gray-500">最終アクセス: {formatDateTimeJst(lastUsedAt)}</p>
          <p className="text-xs text-gray-500">有効期限: 発行から90日固定（アクセスで延長しない）</p>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            void handleIssue()
          }}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {loading ? '発行中...' : hasActiveLink ? '再発行' : '会員証URL'}
        </Button>
        {hasActiveLink ? (
          <Button
            type="button"
            onClick={() => {
              void handleRevoke()
            }}
            disabled={revoking}
            className="bg-slate-600 hover:bg-slate-700"
          >
            {revoking ? '無効化中...' : '無効化'}
          </Button>
        ) : null}
      </div>
      {portalUrl ? (
        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-xs text-amber-700 underline"
        >
          {portalUrl}
        </a>
      ) : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
