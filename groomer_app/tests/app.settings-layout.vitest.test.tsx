import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/Sidebar', () => {
  return {
    Sidebar: () => <aside data-testid="settings-layout-sidebar">settings-layout-sidebar</aside>,
  }
})

import SettingsLayout from '../src/app/settings/layout'

describe('settings layout', () => {
  it('renders sidebar and children content', () => {
    render(
      <SettingsLayout>
        <div data-testid="settings-layout-children">settings-layout-children</div>
      </SettingsLayout>,
    )

    expect(screen.getByTestId('settings-layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('settings-layout-children')).toBeTruthy()
  })
})
