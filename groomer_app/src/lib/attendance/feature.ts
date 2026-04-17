export type AttendanceFeatureState = {
  enabled: boolean
  message: string | null
}

function isMissingStoreShiftSettingsRelation(message: string | null | undefined) {
  const text = `${message ?? ''}`
  return text.includes('store_shift_settings') || text.includes('attendance_punch_enabled')
}

export async function resolveAttendanceFeatureState(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  storeId: string
}): Promise<AttendanceFeatureState> {
  let result: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    error: { message?: string } | null
  }
  try {
    result = await params.db
      .from('store_shift_settings')
      .select('attendance_punch_enabled')
      .eq('store_id', params.storeId)
      .maybeSingle()
  } catch {
    return { enabled: true, message: null }
  }

  if (result.error) {
    if (isMissingStoreShiftSettingsRelation(result.error.message)) {
      return { enabled: true, message: null }
    }
    return { enabled: true, message: result.error.message ?? '勤怠設定の取得に失敗しました。' }
  }

  const enabled = (result.data?.attendance_punch_enabled ?? true) === true
  return { enabled, message: null }
}
