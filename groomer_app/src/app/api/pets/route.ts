import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { buildPetQrProfile } from '@/lib/qr/pet-profile'

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

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('pets')
    .select(
      'id, name, customer_id, breed, gender, date_of_birth, weight, vaccine_date, chronic_diseases, notes, qr_code_url, qr_payload, customers(full_name)'
    )
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
  const name = isJson
    ? typeof body?.name === 'string'
      ? body.name.trim()
      : ''
    : formData?.get('name')?.toString().trim()
  const customerId = isJson
    ? typeof body?.customer_id === 'string'
      ? body.customer_id
      : ''
    : formData?.get('customer_id')?.toString()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!name) {
    return NextResponse.json({ message: 'ペット名は必須です。' }, { status: 400 })
  }

  if (!customerId) {
    return NextResponse.json({ message: '飼い主の選択は必須です。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    name,
    customer_id: customerId,
    breed: isJson
      ? typeof body?.breed === 'string'
        ? body.breed
        : null
      : formData?.get('breed')?.toString() || null,
    gender: isJson
      ? typeof body?.gender === 'string'
        ? body.gender
        : null
      : formData?.get('gender')?.toString() || null,
    date_of_birth: isJson
      ? typeof body?.date_of_birth === 'string'
        ? body.date_of_birth
        : null
      : formData?.get('date_of_birth')?.toString() || null,
    weight: isJson
      ? typeof body?.weight === 'number'
        ? body.weight
        : null
      : formData?.get('weight')
        ? Number(formData?.get('weight'))
        : null,
    vaccine_date: isJson
      ? typeof body?.vaccine_date === 'string'
        ? body.vaccine_date
        : null
      : formData?.get('vaccine_date')?.toString() || null,
    chronic_diseases: isJson
      ? parseList(body?.chronic_diseases ?? null)
      : parseList(formData?.get('chronic_diseases')?.toString() || null),
    notes: isJson
      ? typeof body?.notes === 'string'
        ? body.notes
        : null
      : formData?.get('notes')?.toString() || null,
  }

  const { data: customerInStore } = await supabase
    .from('customers')
    .select('id, full_name, phone_number')
    .eq('id', customerId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (!customerInStore) {
    return NextResponse.json({ message: '選択した顧客はこの店舗に存在しません。' }, { status: 400 })
  }

  const { data: createdPet, error } = await supabase
    .from('pets')
    .insert(payload)
    .select('id, name, customer_id')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (isJson) {
    const qr = buildPetQrProfile({
      customerId: createdPet.customer_id,
      customerName: customerInStore.full_name ?? '未登録顧客',
      phoneNumber: customerInStore.phone_number ?? '',
      petId: createdPet.id,
      petName: createdPet.name ?? '未登録ペット',
      petBreed: payload.breed ?? '',
    })
    await supabase
      .from('pets')
      .update({
        qr_code_url: qr.qrImageUrl,
        qr_payload: qr.qrPayload,
      })
      .eq('id', createdPet.id)
      .eq('store_id', storeId)
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'pet',
      entityId: createdPet.id,
      action: 'created',
      after: {
        ...payload,
        id: createdPet.id,
      },
    })
    return NextResponse.json(createdPet)
  }

  const qr = buildPetQrProfile({
    customerId: createdPet.customer_id,
    customerName: customerInStore.full_name ?? '未登録顧客',
    phoneNumber: customerInStore.phone_number ?? '',
    petId: createdPet.id,
    petName: createdPet.name ?? '未登録ペット',
    petBreed: payload.breed ?? '',
  })
  await supabase
    .from('pets')
    .update({
      qr_code_url: qr.qrImageUrl,
      qr_payload: qr.qrPayload,
    })
    .eq('id', createdPet.id)
    .eq('store_id', storeId)

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pet',
    entityId: createdPet.id,
    action: 'created',
    after: {
      ...payload,
      id: createdPet.id,
    },
  })

  return NextResponse.redirect(new URL('/pets', request.url))
}
