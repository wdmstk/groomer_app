import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    customer_id: string
  }>
}

function parseTags(tags: string | string[] | null | undefined) {
  if (!tags) return null
  if (Array.isArray(tags)) {
    const trimmed = tags.map((tag) => tag.trim()).filter(Boolean)
    return trimmed.length > 0 ? trimmed : null
  }
  const trimmed = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { customer_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .eq('id', customer_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { customer_id } = await params
  const body = await request.json()
  const payload = {
    full_name: body.full_name ?? null,
    phone_number: body.phone_number ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    line_id: body.line_id ?? null,
    how_to_know: body.how_to_know ?? null,
    rank: body.rank ?? null,
    tags: parseTags(body.tags ?? null),
  }

  if (!payload.full_name) {
    return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .eq('id', customer_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customer_id)
    .eq('store_id', storeId)
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'customer',
    entityId: customer_id,
    action: 'updated',
    before,
    after: data,
  })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { customer_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .eq('id', customer_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customer_id)
    .eq('store_id', storeId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (before) {
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'customer',
      entityId: customer_id,
      action: 'deleted',
      before,
    })
  }

  return NextResponse.json({ success: true })
}

async function deleteCustomer(customerId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: before } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .eq('id', customerId)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('store_id', storeId)
  return { error, supabase, storeId, before }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { customer_id } = await context.params

  if (method === 'delete') {
    const { error, supabase, storeId, before } = await deleteCustomer(customer_id)
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (before) {
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'customer',
        entityId: customer_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.redirect(new URL('/customers?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const payload = {
      full_name: formData.get('full_name')?.toString() || null,
      phone_number: formData.get('phone_number')?.toString() || null,
      email: formData.get('email')?.toString() || null,
      address: formData.get('address')?.toString() || null,
      line_id: formData.get('line_id')?.toString() || null,
      how_to_know: formData.get('how_to_know')?.toString() || null,
      rank: formData.get('rank')?.toString() || null,
      tags: parseTags(formData.get('tags')?.toString() || null),
    }

    if (!payload.full_name) {
      return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
    }

    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('customers')
      .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
      .eq('id', customer_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const { data: updatedCustomer, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customer_id)
      .eq('store_id', storeId)
      .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'customer',
      entityId: customer_id,
      action: 'updated',
      before,
      after: updatedCustomer,
    })

    return NextResponse.redirect(new URL('/customers', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
