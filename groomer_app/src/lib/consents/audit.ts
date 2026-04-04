import type { Json } from '@/lib/supabase/database.types'

type ConsentAuditClient = {
  from: (
    table: string
  ) => {
    insert: (values: unknown) => PromiseLike<{ error: { message: string } | null }>
  }
}

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function insertConsentAuditLog(params: {
  supabase: ConsentAuditClient
  storeId: string
  entityType: 'template' | 'template_version' | 'document' | 'signature' | 'delivery'
  entityId: string
  action: string
  actorUserId?: string | null
  before?: unknown
  after?: unknown
  payload?: Json
}) {
  const { error } = await params.supabase.from('consent_audit_logs').insert({
    store_id: params.storeId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    actor_user_id: params.actorUserId ?? null,
    before: toJson(params.before),
    after: toJson(params.after),
    payload: toJson(params.payload ?? {}),
  })
  if (error) throw new Error(error.message)
}

export async function insertConsentAuditLogBestEffort(params: {
  supabase: ConsentAuditClient
  storeId: string
  entityType: 'template' | 'template_version' | 'document' | 'signature' | 'delivery'
  entityId: string
  action: string
  actorUserId?: string | null
  before?: unknown
  after?: unknown
  payload?: Json
}) {
  try {
    await insertConsentAuditLog(params)
  } catch (error) {
    console.error('Failed to insert consent audit log:', error)
  }
}
