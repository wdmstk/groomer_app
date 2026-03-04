import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    menu_id: string
  }>
}

function parseBoolean(value: string | null) {
  if (value === null) return null
  return value === 'true'
}

async function deleteMenu(menuId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { error } = await supabase
    .from('service_menus')
    .delete()
    .eq('id', menuId)
    .eq('store_id', storeId)
  return { error }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { menu_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('service_menus')
    .select(
      'id, name, category, price, duration, tax_rate, tax_included, is_active, display_order, notes'
    )
    .eq('id', menu_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { menu_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const body = await request.json()

  const payload = {
    name: body.name ?? null,
    category: body.category ?? null,
    price: body.price ?? null,
    duration: body.duration ?? null,
    tax_rate: body.tax_rate ?? null,
    tax_included: body.tax_included ?? null,
    is_active: body.is_active ?? null,
    display_order: body.display_order ?? null,
    notes: body.notes ?? null,
  }

  if (!payload.name) {
    return NextResponse.json({ message: 'メニュー名は必須です。' }, { status: 400 })
  }

  if (!payload.price) {
    return NextResponse.json({ message: '価格は必須です。' }, { status: 400 })
  }

  if (!payload.duration) {
    return NextResponse.json({ message: '所要時間は必須です。' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('service_menus')
    .update({ ...payload, store_id: storeId })
    .eq('id', menu_id)
    .eq('store_id', storeId)
    .select(
      'id, name, category, price, duration, tax_rate, tax_included, is_active, display_order, notes'
    )
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { menu_id } = await params
  const { error } = await deleteMenu(menu_id)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { menu_id } = await context.params

  if (method === 'delete') {
    const { error } = await deleteMenu(menu_id)
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/service-menus?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const payload = {
      name: formData.get('name')?.toString() || null,
      category: formData.get('category')?.toString() || null,
      price: formData.get('price') ? Number(formData.get('price')) : null,
      duration: formData.get('duration') ? Number(formData.get('duration')) : null,
      tax_rate: formData.get('tax_rate') ? Number(formData.get('tax_rate')) : null,
      tax_included: parseBoolean(formData.get('tax_included')?.toString() ?? 'true'),
      is_active: parseBoolean(formData.get('is_active')?.toString() ?? 'true'),
      display_order: formData.get('display_order') ? Number(formData.get('display_order')) : 0,
      notes: formData.get('notes')?.toString() || null,
    }

    if (!payload.name) {
      return NextResponse.json({ message: 'メニュー名は必須です。' }, { status: 400 })
    }

    if (!payload.price) {
      return NextResponse.json({ message: '価格は必須です。' }, { status: 400 })
    }

    if (!payload.duration) {
      return NextResponse.json({ message: '所要時間は必須です。' }, { status: 400 })
    }

    const { error } = await supabase
      .from('service_menus')
      .update({ ...payload, store_id: storeId })
      .eq('id', menu_id)
      .eq('store_id', storeId)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.redirect(new URL('/service-menus', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
