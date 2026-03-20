import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asObjectOrNull } from '@/lib/object-utils'

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toOptionalNonNegativeInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

export async function GET(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { searchParams } = new URL(request.url)
  const medicalRecordId = searchParams.get('medical_record_id')?.trim() ?? ''
  const limitRaw = Number(searchParams.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100

  if (!medicalRecordId) {
    return NextResponse.json({ message: 'medical_record_id is required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('medical_record_videos' as never)
    .select(
      'id, medical_record_id, pet_id, appointment_id, storage_path, thumbnail_path, line_short_path, duration_sec, size_bytes, source_type, comment, sort_order, taken_at, created_at, updated_at'
    )
    .eq('store_id', storeId)
    .eq('medical_record_id', medicalRecordId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ videos: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const body: unknown = await request.json().catch(() => null)
  const payload = asObjectOrNull(body)

  if (!payload) {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const medicalRecordId = toOptionalString(payload.medical_record_id)
  const petId = toOptionalString(payload.pet_id)
  const appointmentId = toOptionalString(payload.appointment_id)
  const storagePath = toOptionalString(payload.storage_path)
  const thumbnailPath = toOptionalString(payload.thumbnail_path)
  const lineShortPath = toOptionalString(payload.line_short_path)
  const sourceType = payload.source_type === 'ai_generated' ? 'ai_generated' : 'uploaded'
  const comment = toOptionalString(payload.comment)
  const takenAt = toOptionalString(payload.taken_at)
  const durationSec = toOptionalNonNegativeInt(payload.duration_sec)
  const sizeBytes = toOptionalNonNegativeInt(payload.size_bytes) ?? 0
  const sortOrder = toOptionalNonNegativeInt(payload.sort_order) ?? 0

  if (!medicalRecordId || !petId || !storagePath) {
    return NextResponse.json(
      { message: 'medical_record_id, pet_id, storage_path are required.' },
      { status: 400 }
    )
  }

  const insertPayload = {
    store_id: storeId,
    medical_record_id: medicalRecordId,
    pet_id: petId,
    appointment_id: appointmentId,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    line_short_path: lineShortPath,
    duration_sec: durationSec,
    size_bytes: sizeBytes,
    source_type: sourceType,
    comment,
    sort_order: sortOrder,
    taken_at: takenAt,
  }

  const { data, error } = await supabase
    .from('medical_record_videos' as never)
    .insert(insertPayload)
    .select(
      'id, medical_record_id, pet_id, appointment_id, storage_path, thumbnail_path, line_short_path, duration_sec, size_bytes, source_type, comment, sort_order, taken_at, created_at, updated_at'
    )
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
