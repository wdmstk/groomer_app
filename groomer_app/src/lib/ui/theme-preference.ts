import { DEFAULT_UI_THEME, isUiTheme, type UiTheme } from '@/lib/ui/themes'

export const UI_THEME_COOKIE = 'ui_theme'
export const UI_THEME_STORAGE_KEY = 'active_ui_theme'

export function resolveUiThemeOrDefault(value: unknown): UiTheme {
  return isUiTheme(value) ? value : DEFAULT_UI_THEME
}
