import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function parseDateKeys(value: string | null) {
  if (!value) return []
  const unique = new Set<string>()
  for (const raw of value.split(/\r?\n/)) {
    const dateKey = raw.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    unique.add(dateKey)
  }
  return [...unique].sort()
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const blockedDates = parseDateKeys(formData.get('blocked_dates_jst')?.toString() ?? null)

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membershipError || !membership) {
    return NextResponse.json({ message: '所属情報の取得に失敗しました。' }, { status: 403 })
  }
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ message: 'この操作は owner/admin のみ実行できます。' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('store_public_reserve_blocked_dates')
    .delete()
    .eq('store_id', storeId)
  if (deleteError) {
    return NextResponse.json({ message: deleteError.message }, { status: 500 })
  }

  if (blockedDates.length > 0) {
    const payload = blockedDates.map((dateKey) => ({
      store_id: storeId,
      date_key: dateKey,
      is_active: true,
      reason: 'dashboard_rule',
    }))
    const { error: insertError } = await supabase
      .from('store_public_reserve_blocked_dates')
      .insert(payload)
    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}

