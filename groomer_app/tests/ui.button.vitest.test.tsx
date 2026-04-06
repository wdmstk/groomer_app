import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/ui/Button'

describe('Button component', () => {
  it('renders button label and default classes', () => {
    render(<Button>保存</Button>)

    const button = screen.getByRole('button', { name: '保存' })
    expect(button).toBeTruthy()
    expect(button.className).toContain('px-4')
    expect(button.className).toContain('bg-[var(--button-primary-bg)]')
  })

  it('merges custom className and disabled prop', () => {
    render(
      <Button className="w-full custom-class" disabled>
        送信
      </Button>,
    )

    const button = screen.getByRole('button', { name: '送信' })
    expect(button.className).toContain('custom-class')
    expect(button.className).toContain('w-full')
    expect(button).toHaveProperty('disabled', true)
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>追加</Button>)

    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
