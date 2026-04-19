import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function parseBoolean(value: string | null) {
  if (value === null) return null
  return value === 'true'
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('service_menus')
    .select(
      'id, name, category, price, duration, tax_rate, tax_included, is_active, is_instant_bookable, display_order, notes'
    )
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const name = formData.get('name')?.toString().trim()
  const price = formData.get('price')?.toString()
  const duration = formData.get('duration')?.toString()

  if (!name) {
    return NextResponse.json({ message: 'メニュー名は必須です。' }, { status: 400 })
  }

  if (!price) {
    return NextResponse.json({ message: '価格は必須です。' }, { status: 400 })
  }

  if (!duration) {
    return NextResponse.json({ message: '所要時間は必須です。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    name,
    category: formData.get('category')?.toString() || null,
    price: Number(price),
    duration: Number(duration),
    tax_rate: formData.get('tax_rate') ? Number(formData.get('tax_rate')) : 0.1,
    tax_included: parseBoolean(formData.get('tax_included')?.toString() ?? 'true'),
    is_active: parseBoolean(formData.get('is_active')?.toString() ?? 'true'),
    is_instant_bookable: parseBoolean(formData.get('is_instant_bookable')?.toString() ?? 'false'),
    display_order: formData.get('display_order') ? Number(formData.get('display_order')) : 0,
    notes: formData.get('notes')?.toString() || null,
  }

  const { error } = await supabase.from('service_menus').insert(payload)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/menu-management?tab=trimming', request.url))
}
