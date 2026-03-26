import { NextResponse } from 'next/server'
import { CONSENT_PDF_BUCKET } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ document_id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { document_id: documentId } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: document, error } = await supabase
    .from('consent_documents' as never)
    .select('id, pdf_path, status')
    .eq('store_id', storeId)
    .eq('id', documentId)
    .maybeSingle()
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ message: 'document not found.' }, { status: 404 })
  if (!document.pdf_path) return NextResponse.json({ message: 'pdf not generated yet.' }, { status: 409 })

  const { data, error: signError } = await supabase.storage
    .from(CONSENT_PDF_BUCKET)
    .createSignedUrl(document.pdf_path, 60 * 60)
  if (signError) return NextResponse.json({ message: signError.message }, { status: 500 })
  return NextResponse.json({ ok: true, signed_url: data?.signedUrl ?? null })
}
