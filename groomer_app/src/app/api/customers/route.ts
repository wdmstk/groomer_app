import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

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

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, email, address, line_id, how_to_know, rank, tags')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const isJson = request.headers.get('content-type')?.includes('application/json') ?? false
  const body = isJson ? await request.json().catch(() => null) : null
  const formData = isJson ? null : await request.formData()
  const fullName = isJson
    ? typeof body?.full_name === 'string'
      ? body.full_name.trim()
      : ''
    : formData?.get('full_name')?.toString().trim()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!fullName) {
    return NextResponse.json({ message: '氏名は必須です。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    full_name: fullName,
    phone_number: isJson
      ? typeof body?.phone_number === 'string'
        ? body.phone_number
        : null
      : formData?.get('phone_number')?.toString() || null,
    email: isJson
      ? typeof body?.email === 'string'
        ? body.email
        : null
      : formData?.get('email')?.toString() || null,
    address: isJson
      ? typeof body?.address === 'string'
        ? body.address
        : null
      : formData?.get('address')?.toString() || null,
    line_id: isJson
      ? typeof body?.line_id === 'string'
        ? body.line_id
        : null
      : formData?.get('line_id')?.toString() || null,
    how_to_know: isJson
      ? typeof body?.how_to_know === 'string'
        ? body.how_to_know
        : null
      : formData?.get('how_to_know')?.toString() || null,
    rank: isJson
      ? typeof body?.rank === 'string'
        ? body.rank
        : null
      : formData?.get('rank')?.toString() || null,
    tags: isJson ? parseTags(body?.tags ?? null) : parseTags(formData?.get('tags')?.toString() || null),
  }

  const { data: createdCustomer, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, full_name')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'customer',
    entityId: createdCustomer.id,
    action: 'created',
    after: {
      ...payload,
      id: createdCustomer.id,
    },
  })

  if (isJson) {
    return NextResponse.json(createdCustomer)
  }

  return NextResponse.redirect(new URL('/customers', request.url))
}
