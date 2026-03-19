'use client'

import { useLayoutEffect } from 'react'
import { resolveUiThemeOrDefault, UI_THEME_STORAGE_KEY } from '@/lib/ui/theme-preference'

export function ThemeHydrator() {
  useLayoutEffect(() => {
    const raw = window.sessionStorage.getItem(UI_THEME_STORAGE_KEY)
    if (!raw) {
      const existingTheme = resolveUiThemeOrDefault(document.documentElement.dataset.theme)
      window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, existingTheme)
      return
    }

    const theme = resolveUiThemeOrDefault(raw)
    document.documentElement.dataset.theme = theme
  }, [])

  return null
}
