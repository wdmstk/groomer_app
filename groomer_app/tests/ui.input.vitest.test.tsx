import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from '../src/components/ui/Input'

describe('Input component', () => {
  it('renders textbox with default classes', () => {
    render(<Input aria-label="メモ入力" />)

    const input = screen.getByRole('textbox', { name: 'メモ入力' })
    expect(input).toBeTruthy()
    expect(input.className).toContain('w-full')
    expect(input.className).toContain('focus:ring-blue-400')
  })

  it('merges custom className and forwards props', () => {
    render(
      <Input
        aria-label="顧客名"
        className="custom-class"
        placeholder="山田 太郎"
        required
      />,
    )

    const input = screen.getByRole('textbox', { name: '顧客名' })
    expect(input.className).toContain('custom-class')
    expect(input).toHaveProperty('placeholder', '山田 太郎')
    expect(input).toHaveProperty('required', true)
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<Input aria-label="電話番号" onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox', { name: '電話番号' }), {
      target: { value: '090-0000-0000' },
    })

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
