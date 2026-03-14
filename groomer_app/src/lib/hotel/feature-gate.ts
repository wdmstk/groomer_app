function parseCsv(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function isHotelFeatureEnabledForStore(storeId: string) {
  const enabledStoreIds = parseCsv(process.env.HOTEL_ENABLED_STORE_IDS)
  if (enabledStoreIds.includes('*')) {
    return true
  }
  if (enabledStoreIds.length === 0) {
    return false
  }
  return enabledStoreIds.includes(storeId)
}
