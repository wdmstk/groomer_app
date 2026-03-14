import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { isPlanAtLeast } from '@/lib/subscription-plan'

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('staffs')
    .select('id, full_name, email, user_id, role')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(supabase),
    storeId,
  })
  const isStandardOrHigher = isPlanAtLeast(planState.planCode, 'standard')
  const { count: existingStaffCount } = await supabase
    .from('staffs')
    .select('id', { head: true, count: 'exact' })
    .eq('store_id', storeId)
  const fullName = formData.get('full_name')?.toString().trim()

  if (!fullName) {
    return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
  }
  if (!isStandardOrHigher && (existingStaffCount ?? 0) >= 3) {
    return NextResponse.json(
      { message: 'ライトプランではスタッフ登録上限は3人です。' },
      { status: 403 }
    )
  }

  const payload = {
    store_id: storeId,
    full_name: fullName,
    email: formData.get('email')?.toString() || null,
    user_id: formData.get('user_id')?.toString() || null,
    role: isStandardOrHigher ? formData.get('role')?.toString() || 'staff' : 'staff',
  }

  const { error } = await supabase.from('staffs').insert(payload)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/staffs', request.url))
}
