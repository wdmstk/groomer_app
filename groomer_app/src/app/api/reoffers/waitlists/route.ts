import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const formData = await request.formData()

  const customerId = String(formData.get('customer_id') ?? '').trim()
  const petId = String(formData.get('pet_id') ?? '').trim() || null
  const desiredFrom = String(formData.get('desired_from') ?? '').trim() || null
  const desiredTo = String(formData.get('desired_to') ?? '').trim() || null
  const preferredMenu = String(formData.get('preferred_menu') ?? '').trim() || null
  const preferredStaffId = String(formData.get('preferred_staff_id') ?? '').trim() || null
  const channel = String(formData.get('channel') ?? 'manual').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  const redirectTo = String(formData.get('redirect_to') ?? '/customers?tab=list').trim()

  if (!customerId) {
    return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 })
  }

  await supabase.from('slot_waitlist_requests').insert({
    store_id: storeId,
    customer_id: customerId,
    pet_id: petId,
    desired_from: desiredFrom,
    desired_to: desiredTo,
    preferred_menu: preferredMenu,
    preferred_staff_id: preferredStaffId,
    channel: channel === 'line' || channel === 'phone' ? channel : 'manual',
    notes,
  })

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 })
}
