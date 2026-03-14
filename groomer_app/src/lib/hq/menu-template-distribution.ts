import type { createServerSupabaseClient } from '@/lib/supabase/server'

type HqSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type MenuTemplateOverwriteScope = 'price_duration_only' | 'full'

type ServiceMenuRow = {
  id: string
  store_id: string
  name: string
  category: string | null
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_active: boolean | null
  is_instant_bookable: boolean | null
  display_order: number | null
  notes: string | null
}

function getMenuKey(name: string, category: string | null) {
  return `${name.trim().toLowerCase()}::${(category ?? '').trim().toLowerCase()}`
}

export async function applyMenuTemplateDistribution(params: {
  supabase: HqSupabaseClient
  sourceStoreId: string
  targetStoreIds: string[]
  overwriteScope: MenuTemplateOverwriteScope
}) {
  const { supabase, sourceStoreId, targetStoreIds, overwriteScope } = params

  const { data: sourceMenusData, error: sourceMenusError } = await supabase
    .from('service_menus')
    .select(
      'id, store_id, name, category, price, duration, tax_rate, tax_included, is_active, is_instant_bookable, display_order, notes'
    )
    .eq('store_id', sourceStoreId)

  if (sourceMenusError) {
    return { errorMessage: sourceMenusError.message, results: [] as Array<{ storeId: string; inserted: number; updated: number }> }
  }

  const sourceMenus = (sourceMenusData ?? []) as ServiceMenuRow[]
  if (sourceMenus.length === 0) {
    return { errorMessage: '配布元店舗にテンプレ対象メニューがありません。', results: [] as Array<{ storeId: string; inserted: number; updated: number }> }
  }

  const results: Array<{ storeId: string; inserted: number; updated: number }> = []

  for (const targetStoreId of targetStoreIds) {
    if (targetStoreId === sourceStoreId) {
      results.push({ storeId: targetStoreId, inserted: 0, updated: 0 })
      continue
    }

    const { data: existingMenusData, error: existingMenusError } = await supabase
      .from('service_menus')
      .select(
        'id, store_id, name, category, price, duration, tax_rate, tax_included, is_active, is_instant_bookable, display_order, notes'
      )
      .eq('store_id', targetStoreId)

    if (existingMenusError) {
      return { errorMessage: existingMenusError.message, results }
    }

    const existingMenus = (existingMenusData ?? []) as ServiceMenuRow[]
    const existingByKey = new Map(existingMenus.map((row) => [getMenuKey(row.name, row.category), row]))

    let inserted = 0
    let updated = 0

    for (const sourceMenu of sourceMenus) {
      const key = getMenuKey(sourceMenu.name, sourceMenu.category)
      const existing = existingByKey.get(key)

      if (!existing) {
        const insertPayload = {
          store_id: targetStoreId,
          name: sourceMenu.name,
          category: sourceMenu.category,
          price: sourceMenu.price,
          duration: sourceMenu.duration,
          tax_rate: sourceMenu.tax_rate ?? 0.1,
          tax_included: sourceMenu.tax_included ?? true,
          is_active: sourceMenu.is_active ?? true,
          is_instant_bookable: sourceMenu.is_instant_bookable ?? false,
          display_order: sourceMenu.display_order ?? 0,
          notes: sourceMenu.notes,
        }
        const { error: insertError } = await supabase.from('service_menus').insert(insertPayload)
        if (insertError) {
          return { errorMessage: insertError.message, results }
        }
        inserted += 1
        continue
      }

      const updatePayload =
        overwriteScope === 'full'
          ? {
              name: sourceMenu.name,
              category: sourceMenu.category,
              price: sourceMenu.price,
              duration: sourceMenu.duration,
              tax_rate: sourceMenu.tax_rate ?? 0.1,
              tax_included: sourceMenu.tax_included ?? true,
              is_active: sourceMenu.is_active ?? true,
              is_instant_bookable: sourceMenu.is_instant_bookable ?? false,
              display_order: sourceMenu.display_order ?? 0,
              notes: sourceMenu.notes,
            }
          : {
              price: sourceMenu.price,
              duration: sourceMenu.duration,
            }

      const { error: updateError } = await supabase
        .from('service_menus')
        .update(updatePayload)
        .eq('id', existing.id)
        .eq('store_id', targetStoreId)

      if (updateError) {
        return { errorMessage: updateError.message, results }
      }
      updated += 1
    }

    results.push({ storeId: targetStoreId, inserted, updated })
  }

  return { errorMessage: null, results }
}
