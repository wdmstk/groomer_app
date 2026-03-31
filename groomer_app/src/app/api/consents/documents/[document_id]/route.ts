import { NextResponse } from 'next/server'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import { CONSENT_PDF_BUCKET } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ document_id: string }>
}

type ConsentDocumentDeleteRow = {
  id: string
  status: string
  pdf_path: string | null
  appointment_id: string | null
  customer_id: string
  pet_id: string
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { document_id: documentId } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: current, error: currentError } = await supabase
    .from('consent_documents' as never)
    .select('id, status, pdf_path, appointment_id, customer_id, pet_id')
    .eq('store_id', storeId)
    .eq('id', documentId)
    .maybeSingle()
  const resolvedCurrent = (current as ConsentDocumentDeleteRow | null) ?? null
  if (currentError) return NextResponse.json({ message: currentError.message }, { status: 500 })
  if (!resolvedCurrent) return NextResponse.json({ message: 'document not found.' }, { status: 404 })

  if (resolvedCurrent.pdf_path) {
    await supabase.storage.from(CONSENT_PDF_BUCKET).remove([resolvedCurrent.pdf_path]).catch(() => null)
  }

  const { error } = await supabase
    .from('consent_documents' as never)
    .delete()
    .eq('store_id', storeId)
    .eq('id', documentId)
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  await insertConsentAuditLogBestEffort({
    supabase: supabase as never,
    storeId,
    entityType: 'document',
    entityId: documentId,
    action: 'deleted',
    actorUserId: user?.id ?? null,
    before: resolvedCurrent,
    after: null,
  })

  return NextResponse.json({ ok: true, document_id: documentId })
}
