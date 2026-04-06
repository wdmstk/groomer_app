import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  pushMock,
  redirectMock,
  searchParamsState,
  signInWithPasswordMock,
  signUpMock,
  getUserMock,
  createServerSupabaseClientMock,
} = vi.hoisted(() => {
  return {
    pushMock: vi.fn(),
    redirectMock: vi.fn(),
    searchParamsState: { value: '' },
    signInWithPasswordMock: vi.fn(),
    signUpMock: vi.fn(),
    getUserMock: vi.fn(),
    createServerSupabaseClientMock: vi.fn(),
  }
})

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: pushMock,
      refresh: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(searchParamsState.value),
    redirect: redirectMock,
  }
})

vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    },
  }
})

vi.mock('@/lib/supabase/server', () => {
  return {
    createServerSupabaseClient: createServerSupabaseClientMock,
  }
})

import HomePage from '../src/app/page'
import LoginPage from '../src/app/(auth)/login/page'
import SignupPage from '../src/app/(auth)/signup/page'

describe('home page redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = ''
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    })
  })

  it('redirects authenticated user to /dashboard', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await HomePage()

    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects guest user to /lp', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    await HomePage()

    expect(redirectMock).toHaveBeenCalledWith('/lp')
  })
})

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = ''
  })

  it('shows supabase error on failed login', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'メールまたはパスワードが不正です。' } })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => {
      expect(screen.getByText('メールまたはパスワードが不正です。')).toBeTruthy()
    })
  })

  it('redirects to invite page when invite token exists', async () => {
    searchParamsState.value = 'invite=invite-token'
    signInWithPasswordMock.mockResolvedValue({ error: null })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'valid-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/invite/invite-token')
    })
  })
})

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsState.value = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires legal agreement before sign up', async () => {
    render(<SignupPage />)

    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'new-password' } })
    fireEvent.submit(screen.getByRole('button', { name: '登録する' }).closest('form')!)

    await waitFor(() => {
      expect(
        screen.getByText('利用規約・プライバシーポリシー・特定商取引法表記への同意が必要です。'),
      ).toBeTruthy()
    })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('redirects to /login when signed up without session', async () => {
    vi.useFakeTimers()
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })

    render(<SignupPage />)

    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'new-password' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await vi.runAllTimersAsync()

    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})
