import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { asObjectOrNull } from '@/lib/object-utils'
import { createStoreScopedClient } from '@/lib/supabase/store'

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(request: Request) {
  const body = asObjectOrNull(await request.json().catch(() => null)) ?? {}
  const notes = parseString(body.notes)

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: openSession, error: openSessionError } = await supabase
    .from('pos_sessions')
    .select('id, status, opened_at')
    .eq('store_id', storeId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openSessionError) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_FETCH_FAILED', message: openSessionError.message }, { status: 500 })
  }
  if (openSession?.id) {
    return NextResponse.json(
      {
        ok: false,
        code: 'POS_SESSION_ALREADY_OPEN',
        message: 'open session already exists.',
        data: { session: openSession },
      },
      { status: 409 }
    )
  }

  const { data: session, error: insertError } = await supabase
    .from('pos_sessions')
    .insert({
      store_id: storeId,
      status: 'open',
      notes,
      opened_by_user_id: user?.id ?? null,
    })
    .select('id, status, opened_at, notes')
    .single()

  if (insertError || !session) {
    return NextResponse.json(
      { ok: false, code: 'POS_SESSION_OPEN_FAILED', message: insertError?.message ?? 'failed to open session.' },
      { status: 500 }
    )
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pos_session',
    entityId: session.id,
    action: 'opened',
    after: session,
  })

  return NextResponse.json(
    {
      ok: true,
      data: {
        session,
      },
    },
    { status: 201 }
  )
}
