'use client'

import { useLayoutEffect } from 'react'
import { resolveUiThemeOrDefault, UI_THEME_STORAGE_KEY } from '@/lib/ui/theme-preference'

export function ThemeHydrator() {
  useLayoutEffect(() => {
    const raw = window.sessionStorage.getItem(UI_THEME_STORAGE_KEY)
    const theme = resolveUiThemeOrDefault(raw)
    document.documentElement.dataset.theme = theme
  }, [])

  return null
}
