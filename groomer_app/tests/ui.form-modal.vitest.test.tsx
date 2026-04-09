import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FormModal } from '../src/components/ui/FormModal'

const pushMock = vi.fn()

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: pushMock,
      refresh: vi.fn(),
    }),
  }
})

describe('FormModal component', () => {
  it('closes and reopens when closeRedirectTo is empty', () => {
    render(
      <FormModal title="顧客登録" closeRedirectTo="">
        <div>フォーム本文</div>
      </FormModal>,
    )

    expect(screen.getByText('顧客登録')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    expect(screen.queryByText('顧客登録')).toBeNull()
    expect(screen.getByRole('button', { name: 'モーダルを開く' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'モーダルを開く' }))
    expect(screen.getByText('顧客登録')).toBeTruthy()
  })

  it('pushes redirect path when closeRedirectTo is set', () => {
    pushMock.mockClear()

    render(
      <FormModal title="顧客登録" closeRedirectTo="/customers/manage">
        <div>フォーム本文</div>
      </FormModal>,
    )

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/customers/manage')
  })
})
