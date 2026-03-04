import type { SupabaseClient } from '@supabase/supabase-js'

type MenuSnapshot = {
  id: string
  duration: number
}

type DurationEstimateParams = {
  supabase: SupabaseClient
  storeId: string
  petId: string
  staffId: string
  menus: MenuSnapshot[]
}

export async function estimateDurationMinutes({
  supabase,
  storeId,
  petId,
  staffId,
  menus,
}: DurationEstimateParams) {
  const menuIds = menus.map((menu) => menu.id).filter(Boolean)
  if (menuIds.length === 0) return 0

  const defaultBaseDuration = menus.reduce((sum, menu) => sum + (menu.duration || 0), 0)

  const { data: petRow } = await supabase
    .from('pets')
    .select('breed')
    .eq('id', petId)
    .eq('store_id', storeId)
    .maybeSingle()

  const breed = typeof petRow?.breed === 'string' ? petRow.breed.trim() : ''

  let baseDuration = defaultBaseDuration
  if (breed) {
    const { data: defaultRows, error } = await supabase
      .from('service_duration_defaults')
      .select('menu_id, duration_min')
      .eq('store_id', storeId)
      .eq('breed', breed)
      .in('menu_id', menuIds)

    if (!error && defaultRows) {
      const defaultMap = new Map(
        defaultRows.map((row) => [String(row.menu_id), Number(row.duration_min || 0)])
      )
      baseDuration = menus.reduce((sum, menu) => {
        const overridden = defaultMap.get(menu.id)
        return sum + (overridden && overridden > 0 ? overridden : menu.duration || 0)
      }, 0)
    }
  }

  let factor = 1
  const { data: factorRow, error: factorError } = await supabase
    .from('staff_duration_factors')
    .select('factor')
    .eq('store_id', storeId)
    .eq('staff_id', staffId)
    .maybeSingle()
  if (!factorError && typeof factorRow?.factor === 'number' && Number.isFinite(factorRow.factor)) {
    factor = Math.max(0.5, Math.min(1.5, factorRow.factor))
  }

  return Math.max(1, Math.round(baseDuration * factor))
}
