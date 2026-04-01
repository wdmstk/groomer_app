function parseCsv(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function isJournalFeatureEnabledForStore(storeId: string) {
  const enabledStoreIds = parseCsv(process.env.JOURNAL_ENABLED_STORE_IDS)
  if (enabledStoreIds.includes('*')) return true
  if (enabledStoreIds.length === 0) {
    return process.env.NODE_ENV !== 'production'
  }
  return enabledStoreIds.includes(storeId)
}
