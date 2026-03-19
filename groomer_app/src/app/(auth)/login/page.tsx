'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    const inviteToken = searchParams.get('invite')
    router.push(inviteToken ? `/invite/${inviteToken}` : '/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow sm:p-8">
        <h1 className="mb-4 text-2xl font-bold">ログイン</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border p-2"
          />

          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border p-2"
          />

          {error && <p className="text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full rounded bg-blue-600 p-2 text-white"
          >
            ログイン
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/lp" className="text-blue-700 hover:underline">
            料金・プランを見る
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  )
}
