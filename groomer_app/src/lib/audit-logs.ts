import type { createStoreScopedClient } from '@/lib/supabase/store'
import type { Database, Json } from '@/lib/supabase/database.types'

type AuditSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function insertAuditLog(params: {
  supabase: AuditSupabaseClient
  storeId: string
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  payload?: Json
}) {
  const payload: Database['public']['Tables']['audit_logs']['Insert'] = {
    store_id: params.storeId,
    actor_user_id: params.actorUserId ?? null,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    before: toJson(params.before),
    after: toJson(params.after),
    payload: toJson(params.payload ?? {}),
  }

  const { error } = await params.supabase.from('audit_logs').insert({
    ...payload,
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
  payload?: Json
}) {
  try {
    await insertAuditLog(params)
  } catch (error) {
    console.error('Failed to insert audit log:', error)
  }
}
