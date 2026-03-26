import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import { parseString } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('consent_templates' as never)
    .select('id, name, category, description, status, current_version_id, created_at, updated_at')
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}

export async function POST(request: Request) {
  const body = asObjectOrNull(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ message: 'invalid json body.' }, { status: 400 })

  const name = parseString(body.name)
  const category = parseString(body.category) ?? 'grooming'
  const description = parseString(body.description)
  if (!name) return NextResponse.json({ message: 'name is required.' }, { status: 400 })

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('consent_templates' as never)
    .insert({
      store_id: storeId,
      name,
      category,
      description,
      status: 'draft',
      created_by_user_id: user?.id ?? null,
      updated_by_user_id: user?.id ?? null,
    } as never)
    .select('id, name, category, status, created_at')
    .single()

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  await insertConsentAuditLogBestEffort({
    supabase,
    storeId,
    entityType: 'template',
    entityId: data.id,
    action: 'created',
    actorUserId: user?.id ?? null,
    after: data,
  })

  return NextResponse.json({ ok: true, template: data }, { status: 201 })
}
