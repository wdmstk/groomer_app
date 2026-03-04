import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const FOLLOWUP_STATUSES = new Set<string>([
  'open',
  'in_progress',
  'snoozed',
  'resolved_booked',
  'resolved_no_need',
  'resolved_lost',
] as const)

export const FOLLOWUP_RESOLUTION_TYPES = new Set<string>([
  'booked',
  'declined',
  'unreachable',
  'no_need',
  'other',
] as const)

export const FOLLOWUP_EVENT_TYPES = new Set<string>([
  'task_created',
  'status_changed',
  'contacted_phone',
  'contacted_line',
  'note_added',
  'snoozed',
  'resolved',
  'appointment_created',
] as const)
export type StoreRole = 'owner' | 'admin' | 'staff'

export function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

export function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export function toOptionalDate(value: unknown) {
  const normalized = toOptionalString(value)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function toOptionalDateOnly(value: unknown) {
  const normalized = toOptionalString(value)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return normalized.slice(0, 10)
}

export function isResolvedStatus(status: string | null | undefined) {
  return (
    status === 'resolved_booked' || status === 'resolved_no_need' || status === 'resolved_lost'
  )
}

export async function getFollowupRouteContext() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: jsonError('Unauthorized', 401) }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    return { error: jsonError(membershipError.message, 500) }
  }

  if (!membership) {
    return { error: jsonError('Forbidden', 403) }
  }

  return {
    supabase,
    storeId,
    user,
    role: membership.role as StoreRole,
  }
}

export async function assertFollowupTaskInStore(params: {
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
  storeId: string
  followupId: string
}) {
  const { data, error } = await params.supabase
    .from('customer_followup_tasks')
    .select('id, customer_id, status')
    .eq('id', params.followupId)
    .eq('store_id', params.storeId)
    .maybeSingle()

  if (error) {
    return { error: jsonError(error.message, 500) }
  }

  if (!data) {
    return { error: jsonError('対象フォローアップが見つかりません。', 404) }
  }

  return { data }
}
