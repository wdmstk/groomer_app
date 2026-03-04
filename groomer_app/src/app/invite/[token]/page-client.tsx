'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type InviteAcceptClientProps = {
  token: string
}

export function InviteAcceptClient({ token }: InviteAcceptClientProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [authRequired, setAuthRequired] = useState(false)

  useEffect(() => {
    let mounted = true

    async function acceptInvite() {
      const response = await fetch('/api/store-invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await response.json().catch(() => ({}))) as { message?: string }

      if (!mounted) return

      if (response.status === 401) {
        setAuthRequired(true)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        setError(json.message ?? '招待受諾に失敗しました。')
        setIsLoading(false)
        return
      }

      setMessage(json.message ?? '招待を受け付けました。')
      setIsLoading(false)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 900)
    }

    void acceptInvite()
    return () => {
      mounted = false
    }
  }, [token])

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <section className="mx-auto max-w-lg rounded-lg border bg-white p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-gray-900">スタッフ招待の受諾</h1>
        {isLoading ? <p className="mt-3 text-sm text-gray-600">処理中...</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {authRequired ? (
          <div className="mt-4 space-x-3 text-sm">
            <Link href={`/login?invite=${encodeURIComponent(token)}`} className="text-blue-700 hover:underline">
              ログインして受け取る
            </Link>
            <Link href={`/signup?invite=${encodeURIComponent(token)}`} className="text-blue-700 hover:underline">
              新規登録して受け取る
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  )
}
