import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getMemberPortalPayload, MemberPortalServiceError } from '@/lib/member-portal'
import {
  normalizeMemberPortalWaitlistInput,
  validateMemberPortalWaitlistInput,
} from '@/lib/member-portal-waitlist'
import { pickClientIpFromHeaders, toPrivacyHash } from '@/lib/privacy-hash'

type RouteParams = {
  params: Promise<{
    token: string
  }>
}

type WaitlistWritePayload = {
  pet_id?: string | null
  preferred_menu?: string | null
  preferred_menus?: string[] | null
  preferred_staff_id?: string | null
  channel?: string | null
  desired_from?: string | null
  desired_to?: string | null
  notes?: string | null
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params
  const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
  const uaHash = toPrivacyHash(request.headers.get('user-agent'))

  try {
    const payload = await getMemberPortalPayload(token, {
      accessContext: { ipHash, uaHash },
    })
    const admin = createAdminSupabaseClient()

    const [waitlistResult, petsResult, staffsResult, serviceMenusResult, customerResult] = await Promise.all([
      admin
        .from('slot_waitlist_requests')
        .select(
          'id, pet_id, preferred_menu, preferred_staff_id, channel, desired_from, desired_to, notes, created_at, updated_at'
        )
        .eq('store_id', payload.store.id)
        .eq('customer_id', payload.customer.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('pets')
        .select('id, name')
        .eq('store_id', payload.store.id)
        .eq('customer_id', payload.customer.id)
        .order('created_at', { ascending: true }),
      admin
        .from('staffs')
        .select('id, full_name')
        .eq('store_id', payload.store.id)
        .order('full_name', { ascending: true }),
      admin
        .from('service_menus')
        .select('id, name, duration')
        .eq('store_id', payload.store.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      admin
        .from('customers')
        .select('line_id, phone_number')
        .eq('store_id', payload.store.id)
        .eq('id', payload.customer.id)
        .maybeSingle(),
    ])

    if (waitlistResult.error) {
      throw new MemberPortalServiceError(waitlistResult.error.message, 500)
    }
    if (petsResult.error) {
      throw new MemberPortalServiceError(petsResult.error.message, 500)
    }
    if (staffsResult.error) {
      throw new MemberPortalServiceError(staffsResult.error.message, 500)
    }
    if (serviceMenusResult.error) {
      throw new MemberPortalServiceError(serviceMenusResult.error.message, 500)
    }
    if (customerResult.error) {
      throw new MemberPortalServiceError(customerResult.error.message, 500)
    }

    const customer = customerResult.data ?? null
    const defaultChannel: 'manual' | 'line' | 'phone' = customer?.line_id
      ? 'line'
      : customer?.phone_number
        ? 'phone'
        : 'manual'

    return NextResponse.json(
      {
        waitlist: waitlistResult.data ?? null,
        pets: (petsResult.data ?? []).map((pet) => ({ id: pet.id, name: pet.name })),
        staffs: (staffsResult.data ?? []).map((staff) => ({ id: staff.id, full_name: staff.full_name })),
        serviceMenus: (serviceMenusResult.data ?? []).map((menu) => ({
          id: menu.id,
          name: menu.name,
          duration: menu.duration,
        })),
        defaultChannel,
      },
      { headers: noStoreHeaders() }
    )
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: noStoreHeaders() }
      )
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500, headers: noStoreHeaders() })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params
  const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
  const uaHash = toPrivacyHash(request.headers.get('user-agent'))

  try {
    const portal = await getMemberPortalPayload(token, {
      accessContext: { ipHash, uaHash },
    })
    const admin = createAdminSupabaseClient()
    const body = (await request.json().catch(() => ({}))) as WaitlistWritePayload

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('line_id, phone_number')
      .eq('store_id', portal.store.id)
      .eq('id', portal.customer.id)
      .maybeSingle()

    if (customerError) {
      throw new MemberPortalServiceError(customerError.message, 500)
    }

    const fallbackChannel: 'manual' | 'line' | 'phone' = customer?.line_id
      ? 'line'
      : customer?.phone_number
        ? 'phone'
        : 'manual'

    const normalized = normalizeMemberPortalWaitlistInput(body, fallbackChannel)
    const validationError = validateMemberPortalWaitlistInput(normalized)
    if (validationError) {
      return NextResponse.json(
        { message: validationError },
        { status: 400, headers: noStoreHeaders() }
      )
    }

    const draft = {
      pet_id: normalized.pet_id,
      preferred_menu: normalized.preferred_menu,
      preferred_staff_id: normalized.preferred_staff_id,
      channel: normalized.channel,
      desired_from: normalized.desired_from,
      desired_to: normalized.desired_to,
      notes: normalized.notes,
      updated_at: new Date().toISOString(),
    }

    const { data: existing, error: existingError } = await admin
      .from('slot_waitlist_requests')
      .select('id')
      .eq('store_id', portal.store.id)
      .eq('customer_id', portal.customer.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      throw new MemberPortalServiceError(existingError.message, 500)
    }

    if (existing?.id) {
      const { data: updated, error: updateError } = await admin
        .from('slot_waitlist_requests')
        .update(draft)
        .eq('id', existing.id)
        .eq('store_id', portal.store.id)
        .eq('customer_id', portal.customer.id)
        .select(
          'id, pet_id, preferred_menu, preferred_staff_id, channel, desired_from, desired_to, notes, created_at, updated_at'
        )
        .single()

      if (updateError) {
        throw new MemberPortalServiceError(updateError.message, 500)
      }
      return NextResponse.json(
        {
          message: '空き枠待ちを更新しました。',
          waitlist: updated,
        },
        { headers: noStoreHeaders() }
      )
    }

    const { data: created, error: insertError } = await admin
      .from('slot_waitlist_requests')
      .insert({
        store_id: portal.store.id,
        customer_id: portal.customer.id,
        ...draft,
      })
      .select(
        'id, pet_id, preferred_menu, preferred_staff_id, channel, desired_from, desired_to, notes, created_at, updated_at'
      )
      .single()

    if (insertError) {
      throw new MemberPortalServiceError(insertError.message, 500)
    }

    return NextResponse.json(
      {
        message: '空き枠待ちを登録しました。',
        waitlist: created,
      },
      { status: 201, headers: noStoreHeaders() }
    )
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: noStoreHeaders() }
      )
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500, headers: noStoreHeaders() })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { token } = await params
  const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
  const uaHash = toPrivacyHash(request.headers.get('user-agent'))

  try {
    const portal = await getMemberPortalPayload(token, {
      accessContext: { ipHash, uaHash },
    })
    const admin = createAdminSupabaseClient()

    const { error } = await admin
      .from('slot_waitlist_requests')
      .delete()
      .eq('store_id', portal.store.id)
      .eq('customer_id', portal.customer.id)

    if (error) {
      throw new MemberPortalServiceError(error.message, 500)
    }

    return NextResponse.json(
      { message: '空き枠待ちを解除しました。' },
      { headers: noStoreHeaders() }
    )
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: noStoreHeaders() }
      )
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500, headers: noStoreHeaders() })
  }
}
