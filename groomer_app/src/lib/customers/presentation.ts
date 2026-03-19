export type CustomerPresentationRow = {
  line_id: string | null
  tags: string[] | null
}

export function getCustomerLineStatus(lineId: string | null | undefined) {
  if (lineId) {
    return {
      linked: true,
      badgeLabel: '連携済み',
      detail: lineId,
    }
  }

  return {
    linked: false,
    badgeLabel: '未連携',
    detail: null,
  }
}

export function formatCustomerFallback(value: string | null | undefined) {
  return value && value.trim() ? value : '未登録'
}

export function formatCustomerTags(tags: string[] | null | undefined) {
  return tags && tags.length > 0 ? tags.join(', ') : 'なし'
}

export function formatCustomerNoShowCount(count: number | null | undefined) {
  return count && count > 0 ? `無断CXL ${count}件` : null
}
