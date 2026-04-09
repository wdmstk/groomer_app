import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { CustomerDeleteServiceError, deletePetWithDependencies } from '@/lib/customers/services/delete'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    pet_id: string
  }>
}

function parseList(value: string | string[] | null | undefined) {
  if (!value) return null
  if (Array.isArray(value)) {
    const trimmed = value.map((item) => item.trim()).filter(Boolean)
    return trimmed.length > 0 ? trimmed : null
  }
  const trimmed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { pet_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('pets')
    .select(
      'id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes'
    )
    .eq('id', pet_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { pet_id } = await params
  const body = await request.json()
  const payload = {
    name: body.name ?? null,
    customer_id: body.customer_id ?? null,
    breed: body.breed ?? null,
    coat_volume: body.coat_volume ?? null,
    gender: body.gender ?? null,
    date_of_birth: body.date_of_birth ?? null,
    weight: body.weight ?? null,
    vaccine_date: body.vaccine_date ?? null,
    chronic_diseases: parseList(body.chronic_diseases ?? null),
    notes: body.notes ?? null,
  }

  if (!payload.name) {
    return NextResponse.json({ message: 'ペット名は必須です。' }, { status: 400 })
  }

  if (!payload.customer_id) {
    return NextResponse.json({ message: '飼い主の選択は必須です。' }, { status: 400 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('pets')
    .select('id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
    .eq('id', pet_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const { data: customerInStore } = await supabase
    .from('customers')
    .select('id')
    .eq('id', payload.customer_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!customerInStore) {
    return NextResponse.json({ message: '選択した顧客はこの店舗に存在しません。' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pets')
    .update({ ...payload, store_id: storeId })
    .eq('id', pet_id)
    .eq('store_id', storeId)
    .select(
      'id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes'
    )
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pet',
    entityId: pet_id,
    action: 'updated',
    before,
    after: data,
  })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { pet_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('pets')
    .select('id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
    .eq('id', pet_id)
    .eq('store_id', storeId)
    .maybeSingle()
  try {
    await deletePetWithDependencies({
      supabase,
      storeId,
      petId: pet_id,
    })
  } catch (error) {
    if (error instanceof CustomerDeleteServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to delete pet.'
    return NextResponse.json({ message }, { status: 500 })
  }

  if (before) {
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'pet',
      entityId: pet_id,
      action: 'deleted',
      before,
    })
  }

  return NextResponse.json({ success: true })
}

async function deletePet(petId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: before } = await supabase
    .from('pets')
    .select('id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
    .eq('id', petId)
    .eq('store_id', storeId)
    .maybeSingle()
  try {
    await deletePetWithDependencies({
      supabase,
      storeId,
      petId,
    })
    return { error: null, supabase, storeId, before }
  } catch (error) {
    if (error instanceof CustomerDeleteServiceError) {
      return { error: { message: error.message }, supabase, storeId, before }
    }
    return {
      error: { message: error instanceof Error ? error.message : 'Failed to delete pet.' },
      supabase,
      storeId,
      before,
    }
  }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()

  if (method === 'delete') {
    const { pet_id } = await context.params
    const { error, supabase, storeId, before } = await deletePet(pet_id)
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
        entityType: 'pet',
        entityId: pet_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.redirect(new URL('/customers/manage?view=pets', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { pet_id } = await context.params
    const payload = {
      name: formData.get('name')?.toString() || null,
      customer_id: formData.get('customer_id')?.toString() || null,
      breed: formData.get('breed')?.toString() || null,
      coat_volume: formData.get('coat_volume')?.toString() || null,
      gender: formData.get('gender')?.toString() || null,
      date_of_birth: formData.get('date_of_birth')?.toString() || null,
      weight: formData.get('weight') ? Number(formData.get('weight')) : null,
      vaccine_date: formData.get('vaccine_date')?.toString() || null,
      chronic_diseases: parseList(formData.get('chronic_diseases')?.toString() || null),
      notes: formData.get('notes')?.toString() || null,
    }

    if (!payload.name) {
      return NextResponse.json({ message: 'ペット名は必須です。' }, { status: 400 })
    }

    if (!payload.customer_id) {
      return NextResponse.json({ message: '飼い主の選択は必須です。' }, { status: 400 })
    }

    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('pets')
      .select('id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
      .eq('id', pet_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const { data: customerInStore } = await supabase
      .from('customers')
      .select('id')
      .eq('id', payload.customer_id)
      .eq('store_id', storeId)
      .maybeSingle()

    if (!customerInStore) {
      return NextResponse.json({ message: '選択した顧客はこの店舗に存在しません。' }, { status: 400 })
    }

    const { data: updatedPet, error } = await supabase
      .from('pets')
      .update({ ...payload, store_id: storeId })
      .eq('id', pet_id)
      .eq('store_id', storeId)
      .select('id, name, customer_id, breed, coat_volume, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes')
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'pet',
      entityId: pet_id,
      action: 'updated',
      before,
      after: updatedPet,
    })

    return NextResponse.redirect(
      new URL(`/customers/manage?customer_id=${payload.customer_id}&tab=${pet_id}`, request.url)
    )
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
