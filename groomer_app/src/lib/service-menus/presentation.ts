export function formatServiceMenuCategory(value: string | null | undefined) {
  return value && value.trim() ? value : '未設定'
}

export function formatServiceMenuTaxRate(value: number | null | undefined) {
  return value ?? 0.1
}

export function formatServiceMenuTaxIncluded(value: boolean | null | undefined) {
  return (value ?? true) ? '税込' : '税抜'
}

export function formatServiceMenuActive(value: boolean | null | undefined) {
  return (value ?? true) ? '有効' : '無効'
}

export function formatServiceMenuInstantBookable(value: boolean | null | undefined) {
  return (value ?? false) ? '対象' : '対象外'
}

export function formatServiceMenuNotes(value: string | null | undefined) {
  return value && value.trim() ? value : 'なし'
}
