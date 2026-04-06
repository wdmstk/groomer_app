import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeHydrator } from '../src/components/ui/ThemeHydrator'
import { UI_THEME_STORAGE_KEY } from '../src/lib/ui/theme-preference'

describe('ThemeHydrator component', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    document.documentElement.dataset.theme = ''
  })

  it('persists existing document theme when storage is empty', () => {
    document.documentElement.dataset.theme = 'dark-neon'

    render(<ThemeHydrator />)

    expect(window.sessionStorage.getItem(UI_THEME_STORAGE_KEY)).toBe('dark-neon')
  })

  it('applies valid stored theme to document dataset', () => {
    window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, 'cute-pop')

    render(<ThemeHydrator />)

    expect(document.documentElement.dataset.theme).toBe('cute-pop')
  })

  it('falls back to default theme when stored value is invalid', () => {
    window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, 'invalid-theme')

    render(<ThemeHydrator />)

    expect(document.documentElement.dataset.theme).toBe('clean-medical')
  })
})
