'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Thread = {
  store_id: string
  store_name: string
  is_active: boolean
  last_message: string | null
  last_message_at: string | null
}

type ChatMessage = {
  id: string
  sender_user_id: string
  sender_role: 'developer' | 'owner' | 'staff'
  sender_name: string
  message: string
  created_at: string
}

function formatAt(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSenderName(message: ChatMessage, isMine: boolean) {
  if (isMine) return 'サポート'
  return message.sender_name || '利用者'
}

export function DeveloperSupportChat() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.store_id === selectedStoreId) ?? null,
    [threads, selectedStoreId]
  )

  const loadThreads = useCallback(async () => {
    const response = await fetch('/api/dev/support-chat/threads', { cache: 'no-store' })
    const payload = (await response.json()) as { message?: string; threads?: Thread[] }
    if (!response.ok) throw new Error(payload.message ?? '店舗一覧の取得に失敗しました。')

    const nextThreads = payload.threads ?? []
    setThreads(nextThreads)
    setSelectedStoreId((current) => (current || nextThreads[0]?.store_id || ''))
  }, [])

  const loadMessages = useCallback(async (storeId: string, options?: { background?: boolean }) => {
    if (!storeId) return
    const background = options?.background === true
    if (!background) {
      setIsLoadingMessages(true)
    }
    try {
      const response = await fetch(`/api/dev/support-chat/messages?store_id=${encodeURIComponent(storeId)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as { message?: string; messages?: ChatMessage[] }
      if (!response.ok) throw new Error(payload.message ?? 'メッセージ取得に失敗しました。')
      setMessages(payload.messages ?? [])
      setHasLoadedMessages(true)
    } finally {
      if (!background) {
        setIsLoadingMessages(false)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    async function bootstrap() {
      try {
        await loadThreads()
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : '取得に失敗しました。')
      } finally {
        if (isMounted) setIsLoadingThreads(false)
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [loadThreads])

  useEffect(() => {
    if (!selectedStoreId) return
    setHasLoadedMessages(false)
    setIsLoadingMessages(true)
    void loadMessages(selectedStoreId).catch((e) =>
      setError(e instanceof Error ? e.message : 'メッセージ取得に失敗しました。')
    )
  }, [loadMessages, selectedStoreId])

  useEffect(() => {
    const timer = setInterval(() => {
      void loadThreads().catch(() => {})
      if (selectedStoreId) {
        void loadMessages(selectedStoreId, { background: true }).catch(() => {})
      }
    }, 5000)

    return () => {
      clearInterval(timer)
    }
  }, [loadMessages, loadThreads, selectedStoreId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canSend = useMemo(
    () => selectedStoreId.length > 0 && draft.trim().length > 0 && !isSending,
    [selectedStoreId, draft, isSending]
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return

    setIsSending(true)
    setError('')
    const text = draft.trim()

    try {
      const response = await fetch('/api/dev/support-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId, message: text }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? '送信に失敗しました。')
      setDraft('')
      await Promise.all([loadThreads(), loadMessages(selectedStoreId)])
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました。')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h1 className="text-2xl font-semibold text-gray-900">店舗問い合わせチャット</h1>
        <p className="mt-1 text-sm text-gray-600">左が利用者、右がサポート（自分）の発言です。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px,1fr]">
        <aside className="rounded border bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">店舗一覧</h2>
          {isLoadingThreads ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-gray-500">店舗がありません。</p>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => {
                const isActive = thread.store_id === selectedStoreId
                return (
                  <button
                    key={thread.store_id}
                    type="button"
                    onClick={() => setSelectedStoreId(thread.store_id)}
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{thread.store_name}</p>
                    <p className="mt-1 truncate text-xs text-gray-600">
                      {thread.last_message ?? 'メッセージなし'}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500">{formatAt(thread.last_message_at)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="rounded border bg-white p-3">
          {selectedThread ? (
            <>
              <div className="mb-2 border-b pb-2">
                <p className="text-sm font-semibold text-gray-900">{selectedThread.store_name}</p>
                <p className="text-xs text-gray-500">
                  ステータス: {selectedThread.is_active ? '有効' : '無効'}
                </p>
              </div>

              <div className="h-[420px] overflow-y-auto rounded border bg-gray-50 p-3">
                {isLoadingMessages && !hasLoadedMessages ? (
                  <p className="text-sm text-gray-500">読み込み中...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-gray-500">まだメッセージはありません。</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((row) => {
                      const isMine = row.sender_role === 'developer'
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
                  placeholder="返信メッセージを入力"
                  className="min-h-[64px] flex-1 rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="self-end shrink-0 whitespace-nowrap rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  送信
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-500">店舗を選択してください。</p>
          )}

          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
