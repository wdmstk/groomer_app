import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from '../src/components/ui/Card'

describe('Card component', () => {
  it('renders children and default classes', () => {
    render(<Card>カード本文</Card>)

    const wrapper = screen.getByText('カード本文')
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('p-6')
    expect(wrapper.className).toContain('bg-white')
    expect(wrapper.className).toContain('shadow')
  })

  it('merges custom className', () => {
    render(<Card className="border-2 custom-card">内容</Card>)

    const wrapper = screen.getByText('内容')
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('custom-card')
    expect(wrapper.className).toContain('border-2')
  })
})
