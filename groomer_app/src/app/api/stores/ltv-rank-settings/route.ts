import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
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

  const goldSales = clampInt(Number(formData.get('ltv_gold_annual_sales_threshold')), 0, 9_999_999, 120000)
  const silverSales = clampInt(Number(formData.get('ltv_silver_annual_sales_threshold')), 0, 9_999_999, 60000)
  const bronzeSales = clampInt(Number(formData.get('ltv_bronze_annual_sales_threshold')), 0, 9_999_999, 30000)
  const goldVisits = clampInt(Number(formData.get('ltv_gold_visit_count_threshold')), 0, 365, 12)
  const silverVisits = clampInt(Number(formData.get('ltv_silver_visit_count_threshold')), 0, 365, 6)
  const bronzeVisits = clampInt(Number(formData.get('ltv_bronze_visit_count_threshold')), 0, 365, 3)

  if (!(goldSales >= silverSales && silverSales >= bronzeSales)) {
    return NextResponse.json(
      { message: '売上しきい値は ゴールド >= シルバー >= ブロンズ の順で入力してください。' },
      { status: 400 }
    )
  }
  if (!(goldVisits >= silverVisits && silverVisits >= bronzeVisits)) {
    return NextResponse.json(
      { message: '来店回数しきい値は ゴールド >= シルバー >= ブロンズ の順で入力してください。' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase
    .from('stores')
    .update({
      ltv_gold_annual_sales_threshold: goldSales,
      ltv_silver_annual_sales_threshold: silverSales,
      ltv_bronze_annual_sales_threshold: bronzeSales,
      ltv_gold_visit_count_threshold: goldVisits,
      ltv_silver_visit_count_threshold: silverVisits,
      ltv_bronze_visit_count_threshold: bronzeVisits,
    })
    .eq('id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}
