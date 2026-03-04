import type { createStoreScopedClient } from '@/lib/supabase/store'

type AuditSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export async function insertAuditLog(params: {
  supabase: AuditSupabaseClient
  storeId: string
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  payload?: Record<string, unknown>
}) {
  const { error } = await params.supabase.from('audit_logs').insert({
    store_id: params.storeId,
    actor_user_id: params.actorUserId ?? null,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
    payload: params.payload ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function insertAuditLogBestEffort(params: {
  supabase: AuditSupabaseClient
  storeId: string
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  payload?: Record<string, unknown>
}) {
  try {
    await insertAuditLog(params)
  } catch (error) {
    console.error('Failed to insert audit log:', error)
  }
}
