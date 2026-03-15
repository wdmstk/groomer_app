import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  createMedicalRecord,
  normalizeCreateMedicalRecordInput,
} from '@/lib/medical-records/services/create'
import { MedicalRecordServiceError } from '@/lib/medical-records/services/shared'

function requestPrefersJson(request: Request) {
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('application/json')
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('medical_records')
    .select(
      'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes, pets(name), staffs(full_name)'
    )
    .eq('store_id', storeId)
    .order('record_date', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const input = normalizeCreateMedicalRecordInput(formData)

  try {
    const created = await createMedicalRecord({
      supabase,
      storeId,
      input,
    })
    const { data: createdRecord } = await supabase
      .from('medical_records')
      .select(
        'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes'
      )
      .eq('id', created.id)
      .eq('store_id', storeId)
      .maybeSingle()
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'medical_record',
      entityId: created.id,
      action: 'created',
      after: createdRecord ?? created,
    })
    if (requestPrefersJson(request)) {
      return NextResponse.json({
        id: created.id,
        record: createdRecord ?? created,
      })
    }
    return NextResponse.redirect(new URL('/medical-records', request.url))
  } catch (error) {
    if (error instanceof MedicalRecordServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to create medical record.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
