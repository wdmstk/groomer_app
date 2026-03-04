import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveCurrentStoreId } from '@/lib/supabase/store'

type StoreMembershipRow = {
  store_id: string
  role: 'owner' | 'admin' | 'staff'
  stores?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
}

function pickStoreName(
  relation: StoreMembershipRow['stores']
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation.name ?? null
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const activeStoreId = await resolveCurrentStoreId()

  const { data, error } = await supabase
    .from('store_memberships')
    .select('store_id, role, stores(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const stores = ((data ?? []) as StoreMembershipRow[]).map((row) => ({
    id: row.store_id,
    name: pickStoreName(row.stores) ?? '店舗名未設定',
    role: row.role,
  }))

  return NextResponse.json({
    activeStoreId,
    stores,
    user: {
      email: user.email ?? '',
    },
  })
}
