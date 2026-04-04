import { NextResponse } from 'next/server'
import {
  formatConsentDateJst,
  formatPetAgeFromDateOfBirth,
  renderConsentTemplateHtml,
  renderConsentTemplateText,
} from '@/lib/consents/template-render'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { hashConsentToken, noStoreHeaders } from '@/lib/consents/shared'

type RouteParams = {
  params: Promise<{ token: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const requestUrl = new URL(_request.url)
  const serviceName = requestUrl.searchParams.get('service_name') ?? ''
  const snsUsagePreference = requestUrl.searchParams.get('sns_usage_preference') ?? ''
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
  const consentDocument = document as {
    id: string
    store_id: string
    status: string
    token_expires_at: string | null
    template_version_id: string
    customer_id: string
    pet_id: string
  }

  const expired = consentDocument.token_expires_at && new Date(consentDocument.token_expires_at).getTime() < Date.now()
  if (expired) return NextResponse.json({ message: 'token expired.' }, { status: 410, headers: noStoreHeaders() })

  const [{ data: version }, { data: customer }, { data: pet }] = await Promise.all([
    admin
      .from('consent_template_versions' as never)
      .select('id, title, body_html, body_text, version_no')
      .eq('id', consentDocument.template_version_id)
      .maybeSingle(),
    admin
      .from('customers')
      .select('id, full_name, address, phone_number')
      .eq('id', consentDocument.customer_id)
      .maybeSingle(),
    admin
      .from('pets')
      .select('id, name, breed, gender, date_of_birth')
      .eq('id', consentDocument.pet_id)
      .maybeSingle(),
  ])

  const { data: store } = await admin
    .from('stores')
    .select('id, name')
    .eq('id', consentDocument.store_id)
    .maybeSingle()

  const templateVersion = version as {
    id: string
    title: string | null
    body_html: string | null
    body_text: string | null
    version_no: number | null
  } | null
  const renderedVersion =
    templateVersion
      ? {
          ...templateVersion,
          body_html: renderConsentTemplateHtml(String(templateVersion.body_html ?? ''), {
            store_name: String(store?.name ?? ''),
            customer_name: String(customer?.full_name ?? 'ー'),
            customer_address: String(customer?.address ?? 'ー'),
            customer_phone: String(customer?.phone_number ?? 'ー'),
            pet_name: String(pet?.name ?? 'ー'),
            pet_species: 'ー',
            pet_breed: String(pet?.breed ?? 'ー'),
            pet_age: formatPetAgeFromDateOfBirth(
              typeof pet?.date_of_birth === 'string' ? pet.date_of_birth : null
            ) || 'ー',
            pet_gender: String(pet?.gender ?? 'ー'),
            service_name: serviceName,
            sns_usage_preference: snsUsagePreference,
            consent_date: formatConsentDateJst(),
          }),
          body_text: renderConsentTemplateText(String(templateVersion.body_text ?? ''), {
            store_name: String(store?.name ?? ''),
            customer_name: String(customer?.full_name ?? 'ー'),
            customer_address: String(customer?.address ?? 'ー'),
            customer_phone: String(customer?.phone_number ?? 'ー'),
            pet_name: String(pet?.name ?? 'ー'),
            pet_species: 'ー',
            pet_breed: String(pet?.breed ?? 'ー'),
            pet_age: formatPetAgeFromDateOfBirth(
              typeof pet?.date_of_birth === 'string' ? pet.date_of_birth : null
            ) || 'ー',
            pet_gender: String(pet?.gender ?? 'ー'),
            service_name: serviceName,
            sns_usage_preference: snsUsagePreference,
            consent_date: formatConsentDateJst(),
          }),
        }
      : null

  return NextResponse.json({
    ok: true,
    document: {
      id: consentDocument.id,
      status: consentDocument.status,
      expires_at: consentDocument.token_expires_at,
    },
    template_version: renderedVersion,
    customer: customer ?? null,
    pet: pet ?? null,
  }, { headers: noStoreHeaders() })
}
