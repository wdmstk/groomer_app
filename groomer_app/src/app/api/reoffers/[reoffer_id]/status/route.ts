import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asObjectOrNull } from '@/lib/object-utils'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reoffer_id: string }> }
) {
  const { reoffer_id } = await context.params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)

  const status = typeof body?.status === 'string' ? body.status : ''
  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  if (!['accepted', 'expired', 'canceled'].includes(status)) {
    return NextResponse.json({ message: 'status が不正です。' }, { status: 400 })
  }

  const { data: current, error: currentError } = await supabase
    .from('slot_reoffers')
    .select('id, appointment_id, target_customer_id, target_pet_id, target_staff_id, status')
    .eq('id', reoffer_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (currentError) {
    return NextResponse.json({ message: currentError.message }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ message: '再販レコードが見つかりません。' }, { status: 404 })
  }

  const patch: Record<string, string | null> = {
    status,
    notes,
  }
  if (status === 'accepted') {
    patch.accepted_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('slot_reoffers')
    .update(patch)
    .eq('id', reoffer_id)
    .eq('store_id', storeId)
    .select('id, appointment_id, status, sent_at, accepted_at, notes')
    .single()

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  if (status === 'accepted') {
    const { data: siblingReoffers, error: siblingError } = await supabase
      .from('slot_reoffers')
      .select('id, target_customer_id, target_pet_id, target_staff_id')
      .eq('store_id', storeId)
      .eq('appointment_id', current.appointment_id)
      .in('status', ['draft', 'sent'])
      .neq('id', reoffer_id)

    if (siblingError) {
      return NextResponse.json({ message: siblingError.message }, { status: 500 })
    }

    const siblingIds = (siblingReoffers ?? []).map((row) => row.id)
    if (siblingIds.length > 0) {
      const { error: siblingUpdateError } = await supabase
        .from('slot_reoffers')
        .update({
          status: 'canceled',
          notes: '別顧客で再販成立のため自動クローズ',
        })
        .eq('store_id', storeId)
        .eq('appointment_id', current.appointment_id)
        .in('id', siblingIds)

      if (siblingUpdateError) {
        return NextResponse.json({ message: siblingUpdateError.message }, { status: 500 })
      }

      if (siblingReoffers.length > 0) {
        const { error: siblingLogError } = await supabase.from('slot_reoffer_logs').insert(
          siblingReoffers.map((row) => ({
            store_id: storeId,
            slot_reoffer_id: row.id,
            appointment_id: current.appointment_id,
            actor_user_id: user?.id ?? null,
            event_type: 'canceled',
            payload: {
              target_customer_id: row.target_customer_id,
              target_pet_id: row.target_pet_id,
              target_staff_id: row.target_staff_id,
              notes: '別顧客で再販成立のため自動クローズ',
              auto_closed_by_reoffer_id: reoffer_id,
            },
          }))
        )

        if (siblingLogError) {
          return NextResponse.json({ message: siblingLogError.message }, { status: 500 })
        }
      }
    }
  }

  const eventType = status === 'accepted' ? 'accepted' : status
  const { error: logError } = await supabase.from('slot_reoffer_logs').insert({
    store_id: storeId,
    slot_reoffer_id: reoffer_id,
    appointment_id: current.appointment_id,
    actor_user_id: user?.id ?? null,
    event_type: eventType,
    payload: {
      target_customer_id: current.target_customer_id,
      target_pet_id: current.target_pet_id,
      target_staff_id: current.target_staff_id,
      notes,
    },
  })

  if (logError) {
    return NextResponse.json({ message: logError.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'slot_reoffer',
    entityId: reoffer_id,
    action: 'status_changed',
    before: current,
    after: updated,
    payload: {
      from_status: current.status,
      to_status: status,
    },
  })

  return NextResponse.json({ reoffer: updated })
}
