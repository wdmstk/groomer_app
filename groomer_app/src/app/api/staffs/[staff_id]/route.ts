import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    staff_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { staff_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('staffs')
    .select('id, full_name, email, user_id, role')
    .eq('id', staff_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { staff_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const body = await request.json()
  const payload = {
    full_name: body.full_name ?? null,
    email: body.email ?? null,
    user_id: body.user_id ?? null,
    role: body.role ?? null,
  }

  if (!payload.full_name) {
    return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('staffs')
    .update({ ...payload, store_id: storeId })
    .eq('id', staff_id)
    .eq('store_id', storeId)
    .select('id, full_name, email, user_id, role')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { staff_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { error } = await supabase
    .from('staffs')
    .delete()
    .eq('id', staff_id)
    .eq('store_id', storeId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function deleteStaff(staffId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { error } = await supabase
    .from('staffs')
    .delete()
    .eq('id', staffId)
    .eq('store_id', storeId)
  return { error }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { staff_id } = await context.params

  if (method === 'delete') {
    const { error } = await deleteStaff(staff_id)
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/staffs?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const payload = {
      full_name: formData.get('full_name')?.toString() || null,
      email: formData.get('email')?.toString() || null,
      user_id: formData.get('user_id')?.toString() || null,
      role: formData.get('role')?.toString() || 'staff',
    }

    if (!payload.full_name) {
      return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
    }

    const { error } = await supabase
      .from('staffs')
      .update({ ...payload, store_id: storeId })
      .eq('id', staff_id)
      .eq('store_id', storeId)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.redirect(new URL('/staffs', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
