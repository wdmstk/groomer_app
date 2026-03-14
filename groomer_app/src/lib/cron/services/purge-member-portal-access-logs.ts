import { createAdminSupabaseClient } from '@/lib/supabase/admin'

const RETENTION_DAYS = 90
const TARGET_ENTITY_TYPE = 'member_portal_link'
const TARGET_ACTIONS = ['accessed', 'access_expired', 'access_revoked']

export async function runPurgeMemberPortalAccessLogsJob() {
  const admin = createAdminSupabaseClient()
  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await admin
    .from('audit_logs')
    .delete({ count: 'exact' })
    .eq('entity_type', TARGET_ENTITY_TYPE)
    .in('action', TARGET_ACTIONS)
    .lt('created_at', cutoffIso)

  if (error) {
    throw new Error(`Failed to purge member portal access logs: ${error.message}`)
  }

  return {
    retentionDays: RETENTION_DAYS,
    cutoffIso,
    deletedCount: count ?? 0,
    targetEntityType: TARGET_ENTITY_TYPE,
    targetActions: TARGET_ACTIONS,
    counters: {
      deletedCount: count ?? 0,
    },
  }
}
