import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { hashConsentToken, noStoreHeaders } from '@/lib/consents/shared'

type RouteParams = {
  params: Promise<{ token: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params
  const tokenHash = hashConsentToken(token)
  const admin = createAdminSupabaseClient()

  const { data: document, error } = await admin
    .from('consent_documents' as never)
    .select('id, store_id, status, token_expires_at, template_version_id, customer_id, pet_id')
    .eq('sign_token_hash', tokenHash)
    .maybeSingle()
  if (error) return NextResponse.json({ message: error.message }, { status: 500, headers: noStoreHeaders() })
  if (!document) return NextResponse.json({ message: 'document not found.' }, { status: 404, headers: noStoreHeaders() })

  const expired = document.token_expires_at && new Date(document.token_expires_at).getTime() < Date.now()
  if (expired) return NextResponse.json({ message: 'token expired.' }, { status: 410, headers: noStoreHeaders() })

  const [{ data: version }, { data: customer }, { data: pet }] = await Promise.all([
    admin
      .from('consent_template_versions' as never)
      .select('id, title, body_html, body_text, version_no')
      .eq('id', document.template_version_id)
      .maybeSingle(),
    admin
      .from('customers')
      .select('id, full_name')
      .eq('id', document.customer_id)
      .maybeSingle(),
    admin
      .from('pets')
      .select('id, name')
      .eq('id', document.pet_id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    ok: true,
    document: {
      id: document.id,
      status: document.status,
      expires_at: document.token_expires_at,
    },
    template_version: version ?? null,
    customer: customer ?? null,
    pet: pet ?? null,
  }, { headers: noStoreHeaders() })
}
