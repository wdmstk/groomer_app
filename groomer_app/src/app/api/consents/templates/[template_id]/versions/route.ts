import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import { parseString } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ template_id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { template_id: templateId } = await params
  const body = asObjectOrNull(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ message: 'invalid json body.' }, { status: 400 })

  const title = parseString(body.title)
  const bodyHtml = parseString(body.body_html)
  const bodyText = parseString(body.body_text)
  const publish = body.publish !== false
  if (!title || !bodyHtml || !bodyText) {
    return NextResponse.json({ message: 'title/body_html/body_text are required.' }, { status: 400 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: template, error: templateError } = await supabase
    .from('consent_templates' as never)
    .select('id, name, status')
    .eq('store_id', storeId)
    .eq('id', templateId)
    .maybeSingle()
  if (templateError) return NextResponse.json({ message: templateError.message }, { status: 500 })
  if (!template) return NextResponse.json({ message: 'template not found.' }, { status: 404 })

  const { data: latest, error: latestError } = await supabase
    .from('consent_template_versions' as never)
    .select('version_no')
    .eq('store_id', storeId)
    .eq('template_id', templateId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) return NextResponse.json({ message: latestError.message }, { status: 500 })

  const versionNo = Number(latest?.version_no ?? 0) + 1
  const documentHash = crypto.createHash('sha256').update(bodyHtml).digest('hex')
  const nowIso = new Date().toISOString()

  const { data: version, error: versionError } = await supabase
    .from('consent_template_versions' as never)
    .insert({
      store_id: storeId,
      template_id: templateId,
      version_no: versionNo,
      title,
      body_html: bodyHtml,
      body_text: bodyText,
      document_hash: documentHash,
      published_at: publish ? nowIso : null,
      published_by_user_id: publish ? user?.id ?? null : null,
      created_by_user_id: user?.id ?? null,
    } as never)
    .select('id, template_id, version_no, title, document_hash, published_at')
    .single()

  if (versionError || !version) {
    return NextResponse.json({ message: versionError?.message ?? 'failed to create version.' }, { status: 500 })
  }

  await insertConsentAuditLogBestEffort({
    supabase,
    storeId,
    entityType: 'template_version',
    entityId: version.id,
    action: publish ? 'created_and_published' : 'created',
    actorUserId: user?.id ?? null,
    after: version,
    payload: {
      template_id: templateId,
      publish,
    },
  })

  if (publish) {
    const { error: updateTemplateError } = await supabase
      .from('consent_templates' as never)
      .update({
        current_version_id: version.id,
        status: 'published',
        updated_by_user_id: user?.id ?? null,
        updated_at: nowIso,
      } as never)
      .eq('store_id', storeId)
      .eq('id', templateId)
    if (updateTemplateError) return NextResponse.json({ message: updateTemplateError.message }, { status: 500 })

    await insertConsentAuditLogBestEffort({
      supabase,
      storeId,
      entityType: 'template',
      entityId: templateId,
      action: 'published',
      actorUserId: user?.id ?? null,
      before: template,
      after: {
        ...template,
        current_version_id: version.id,
        status: 'published',
      },
      payload: {
        current_version_id: version.id,
        version_no: version.version_no,
      },
    })
  }

  return NextResponse.json({ ok: true, version }, { status: 201 })
}
