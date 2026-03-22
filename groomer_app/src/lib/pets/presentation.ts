type RelatedRecord = Record<string, string>

export function getPetRelatedValue<T extends RelatedRecord>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

export function formatPetWeight(weight: number | null | undefined) {
  return weight === null || weight === undefined ? '未登録' : `${weight} kg`
}

export function formatPetList(values: string[] | null | undefined, emptyLabel = 'なし') {
  return values && values.length > 0 ? values.join(', ') : emptyLabel
}

export function formatPetFallback(value: string | null | undefined) {
  return value && value.trim() ? value : '未登録'
}
