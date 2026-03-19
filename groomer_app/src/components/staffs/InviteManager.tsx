'use client'

import { FormEvent, useEffect, useState } from 'react'
import { formatInviteExpiresAt } from '@/lib/staffs/presentation'

type InviteRow = {
  id: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  token: string
  expires_at: string
}

export function InviteManager() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadInvites() {
    const response = await fetch('/api/store-invites', { cache: 'no-store' })
    const json = (await response.json().catch(() => ({}))) as {
      invites?: InviteRow[]
      message?: string
    }
    if (!response.ok) {
      setError(json.message ?? '招待一覧の取得に失敗しました。')
      setIsLoading(false)
      return
    }
    setInvites(json.invites ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    void loadInvites()
  }, [])

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/store-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        setError(json.message ?? '招待作成に失敗しました。')
        return
      }

      setMessage(json.message ?? '招待リンクを作成しました。')
      setEmail('')
      await loadInvites()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopyInviteUrl(token: string) {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setMessage('招待URLをコピーしました。')
      setError('')
    } catch {
      setError('招待URLのコピーに失敗しました。')
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">スタッフ招待</h2>
      <form onSubmit={handleCreateInvite} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="招待するメールアドレス"
          className="rounded border p-2 text-sm"
          required
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'staff')}
          className="rounded border p-2 text-sm"
        >
          <option value="staff">staff</option>
          <option value="admin">admin</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isSubmitting ? '作成中...' : '招待リンク作成'}
        </button>
      </form>
      <p className="text-xs text-gray-500">招待リンクの作成権限は `owner` / `admin` です。</p>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-gray-500">招待一覧を読み込み中...</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-gray-500">有効な招待はありません。</p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <article key={invite.id} className="rounded border p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{invite.email}</p>
              <p>ロール: {invite.role}</p>
              <p>有効期限: {formatInviteExpiresAt(invite.expires_at)}</p>
              <button
                type="button"
                onClick={() => {
                  void handleCopyInviteUrl(invite.token)
                }}
                className="mt-2 rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
              >
                招待URLをコピー
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
