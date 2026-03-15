import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { enqueueMedicalRecordAiTagJob } from '@/lib/medical-records/ai-tags'
import { deleteMedicalRecord } from '@/lib/medical-records/services/delete'
import { MedicalRecordServiceError } from '@/lib/medical-records/services/shared'
import {
  normalizeUpdateMedicalRecordFormInput,
  normalizeUpdateMedicalRecordJsonInput,
  updateMedicalRecord,
} from '@/lib/medical-records/services/update'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

function requestPrefersJson(request: Request) {
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('application/json')
}

const medicalRecordAuditSelect =
  'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes, tags, ai_tag_status, ai_tag_error, ai_tag_last_analyzed_at, ai_tag_source'

export async function GET(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('medical_records')
    .select(
      'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes, tags, ai_tag_status, ai_tag_error, ai_tag_last_analyzed_at, ai_tag_source'
    )
    .eq('id', record_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('medical_records')
    .select(medicalRecordAuditSelect)
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const body: unknown = await request.json().catch(() => null)
  const input = normalizeUpdateMedicalRecordJsonInput(body)

  try {
    const data = await updateMedicalRecord({
      supabase,
      storeId,
      recordId: record_id,
      input,
    })
    if ((input.photoDrafts?.length ?? 0) > 0) {
      await enqueueMedicalRecordAiTagJob({
        supabase,
        storeId,
        medicalRecordId: record_id,
        requestedByUserId: user?.id ?? null,
        source: 'record_saved',
      })
    }
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'medical_record',
      entityId: record_id,
      action: 'updated',
      before,
      after: data,
    })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof MedicalRecordServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to update medical record.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('medical_records')
    .select(medicalRecordAuditSelect)
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()
  try {
    const result = await deleteMedicalRecord({
      supabase,
      storeId,
      recordId: record_id,
    })
    if (before) {
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'medical_record',
        entityId: record_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof MedicalRecordServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to delete medical record.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { record_id } = await context.params

  if (method === 'delete') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('medical_records')
      .select(medicalRecordAuditSelect)
      .eq('id', record_id)
      .eq('store_id', storeId)
      .maybeSingle()
    try {
      await deleteMedicalRecord({
        supabase,
        storeId,
        recordId: record_id,
      })
      if (before) {
        await insertAuditLogBestEffort({
          supabase,
          storeId,
          actorUserId: user?.id ?? null,
          entityType: 'medical_record',
          entityId: record_id,
          action: 'deleted',
          before,
        })
      }
    } catch (error) {
      if (error instanceof MedicalRecordServiceError) {
        return NextResponse.json({ message: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to delete medical record.'
      return NextResponse.json({ message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/medical-records?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('medical_records')
      .select(medicalRecordAuditSelect)
      .eq('id', record_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const input = normalizeUpdateMedicalRecordFormInput(formData)

    try {
      const updated = await updateMedicalRecord({
        supabase,
        storeId,
        recordId: record_id,
        input,
      })
      if ((input.photoDrafts?.length ?? 0) > 0) {
        await enqueueMedicalRecordAiTagJob({
          supabase,
          storeId,
          medicalRecordId: record_id,
          requestedByUserId: user?.id ?? null,
          source: 'record_saved',
        })
      }
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'medical_record',
        entityId: record_id,
        action: 'updated',
        before,
        after: updated,
      })
      if (requestPrefersJson(request)) {
        return NextResponse.json(updated)
      }
      return NextResponse.redirect(new URL('/medical-records', request.url))
    } catch (error) {
      if (error instanceof MedicalRecordServiceError) {
        return NextResponse.json({ message: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to update medical record.'
      return NextResponse.json({ message }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
