'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

type ChatMessage = {
  id: string
  sender_user_id: string
  sender_role: 'developer' | 'owner' | 'staff'
  sender_name: string
  message: string
  created_at: string
}

function formatAt(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSenderName(message: ChatMessage, isMine: boolean) {
  if (isMine) return message.sender_name || 'あなた'
  return message.sender_name || '利用者'
}

export function OwnerSupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  async function loadMessages() {
    const response = await fetch('/api/support-chat/messages', { cache: 'no-store' })
    const payload = (await response.json()) as {
      message?: string
      currentUserId?: string
      messages?: ChatMessage[]
    }
    if (!response.ok) {
      throw new Error(payload.message ?? 'メッセージ取得に失敗しました。')
    }
    setCurrentUserId(payload.currentUserId ?? '')
    setMessages(payload.messages ?? [])
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      try {
        await loadMessages()
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'メッセージ取得に失敗しました。')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void bootstrap()

    const timer = setInterval(() => {
      void loadMessages().catch(() => {})
    }, 5000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return

    setIsSending(true)
    setError('')
    const text = draft.trim()

    try {
      const response = await fetch('/api/support-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? '送信に失敗しました。')
      }
      setDraft('')
      await loadMessages()
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました。')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">問い合わせ</h2>
        <p className="mt-1 text-sm text-gray-600">
          左が相手、右が自分の発言です。他店舗の会話は表示されません。
        </p>
      </div>

      <div className="rounded border bg-white p-3">
        <div className="h-[420px] overflow-y-auto rounded border bg-gray-50 p-3">
          {isLoading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500">まだメッセージはありません。</p>
          ) : (
            <div className="space-y-3">
              {messages.map((row) => {
                const isMine = row.sender_user_id === currentUserId
                return (
                  <div key={row.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        isMine ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 border'
                      }`}
                    >
                      <p className={`mb-1 text-[11px] font-semibold ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                        {getSenderName(row, isMine)}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{row.message}</p>
                      <p className={`mt-1 text-[10px] ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                        {formatAt(row.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="問い合わせ内容を入力してください"
            className="min-h-[64px] flex-1 rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="self-end rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            送信
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  )
}
