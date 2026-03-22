import type { createServerSupabaseClient } from '@/lib/supabase/server'

type HqSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export type HotelMenuTemplateOverwriteScope = 'price_duration_only' | 'full'

type HotelMenuItemRow = {
  id: string
  store_id: string
  item_type: string
  name: string
  price: number
  billing_unit: string
  default_quantity: number
  duration_minutes: number | null
  counts_toward_capacity: boolean
  tax_rate: number
  tax_included: boolean
  is_active: boolean
  display_order: number
  notes: string | null
}

function getItemKey(itemType: string, name: string) {
  return `${itemType.trim().toLowerCase()}::${name.trim().toLowerCase()}`
}

export async function applyHotelMenuTemplateDistribution(params: {
  supabase: HqSupabaseClient
  sourceStoreId: string
  targetStoreIds: string[]
  overwriteScope: HotelMenuTemplateOverwriteScope
}) {
  const { supabase, sourceStoreId, targetStoreIds, overwriteScope } = params

  const { data: sourceItemsData, error: sourceItemsError } = await supabase
    .from('hotel_menu_items')
    .select(
      'id, store_id, item_type, name, price, billing_unit, default_quantity, duration_minutes, counts_toward_capacity, tax_rate, tax_included, is_active, display_order, notes'
    )
    .eq('store_id', sourceStoreId)

  if (sourceItemsError) {
    return { errorMessage: sourceItemsError.message, results: [] as Array<{ storeId: string; inserted: number; updated: number }> }
  }

  const sourceItems = (sourceItemsData ?? []) as HotelMenuItemRow[]
  if (sourceItems.length === 0) {
    return { errorMessage: '配布元店舗にテンプレ対象のホテルメニューがありません。', results: [] as Array<{ storeId: string; inserted: number; updated: number }> }
  }

  const results: Array<{ storeId: string; inserted: number; updated: number }> = []

  for (const targetStoreId of targetStoreIds) {
    if (targetStoreId === sourceStoreId) {
      results.push({ storeId: targetStoreId, inserted: 0, updated: 0 })
      continue
    }

    const { data: existingItemsData, error: existingItemsError } = await supabase
      .from('hotel_menu_items')
      .select(
        'id, store_id, item_type, name, price, billing_unit, default_quantity, duration_minutes, counts_toward_capacity, tax_rate, tax_included, is_active, display_order, notes'
      )
      .eq('store_id', targetStoreId)

    if (existingItemsError) {
      return { errorMessage: existingItemsError.message, results }
    }

    const existingItems = (existingItemsData ?? []) as HotelMenuItemRow[]
    const existingByKey = new Map(existingItems.map((row) => [getItemKey(row.item_type, row.name), row]))

    let inserted = 0
    let updated = 0

    for (const sourceItem of sourceItems) {
      const key = getItemKey(sourceItem.item_type, sourceItem.name)
      const existing = existingByKey.get(key)

      if (!existing) {
        const insertPayload = {
          store_id: targetStoreId,
          item_type: sourceItem.item_type,
          name: sourceItem.name,
          price: sourceItem.price,
          billing_unit: sourceItem.billing_unit,
          default_quantity: sourceItem.default_quantity,
          duration_minutes: sourceItem.duration_minutes,
          counts_toward_capacity: sourceItem.counts_toward_capacity,
          tax_rate: sourceItem.tax_rate,
          tax_included: sourceItem.tax_included,
          is_active: sourceItem.is_active,
          display_order: sourceItem.display_order,
          notes: sourceItem.notes,
        }
        const { error: insertError } = await supabase.from('hotel_menu_items').insert(insertPayload)
        if (insertError) {
          return { errorMessage: insertError.message, results }
        }
        inserted += 1
        continue
      }

      const updatePayload =
        overwriteScope === 'full'
          ? {
              item_type: sourceItem.item_type,
              name: sourceItem.name,
              price: sourceItem.price,
              billing_unit: sourceItem.billing_unit,
              default_quantity: sourceItem.default_quantity,
              duration_minutes: sourceItem.duration_minutes,
              counts_toward_capacity: sourceItem.counts_toward_capacity,
              tax_rate: sourceItem.tax_rate,
              tax_included: sourceItem.tax_included,
              is_active: sourceItem.is_active,
              display_order: sourceItem.display_order,
              notes: sourceItem.notes,
            }
          : {
              price: sourceItem.price,
              duration_minutes: sourceItem.duration_minutes,
            }

      const { error: updateError } = await supabase
        .from('hotel_menu_items')
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
