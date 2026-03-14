export const UI_THEMES = [
  'cute-pop',
  'kawaii-minimal',
  'black-luxe',
  'dark-neon',
  'natural-organic',
  'clean-medical',
  'luxury-salon',
  'playful-pet',
] as const

export type UiTheme = (typeof UI_THEMES)[number]

export const DEFAULT_UI_THEME: UiTheme = 'clean-medical'

const THEME_LABELS: Record<UiTheme, string> = {
  'cute-pop': 'Cute Pop',
  'kawaii-minimal': 'Kawaii Minimal',
  'black-luxe': 'Black Luxe',
  'dark-neon': 'Dark Neon',
  'natural-organic': 'Natural Organic',
  'clean-medical': 'Clean Medical',
  'luxury-salon': 'Luxury Salon',
  'playful-pet': 'Playful Pet',
}

export function getUiThemeLabel(theme: UiTheme) {
  return THEME_LABELS[theme]
}

export function isUiTheme(value: unknown): value is UiTheme {
  return typeof value === 'string' && (UI_THEMES as readonly string[]).includes(value)
}
