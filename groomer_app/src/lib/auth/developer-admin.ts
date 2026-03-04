import { createServerSupabaseClient } from '@/lib/supabase/server'

function parseCsv(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export async function requireDeveloperAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (error || !user) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }

  const allowedEmails = parseCsv(process.env.DEVELOPER_ADMIN_EMAILS)
  const allowedUserIds = parseCsv(process.env.DEVELOPER_ADMIN_USER_IDS)

  const userEmail = (user.email ?? '').toLowerCase()
  const userId = user.id.toLowerCase()
  const matched =
    (userEmail.length > 0 && allowedEmails.includes(userEmail)) || allowedUserIds.includes(userId)

  if (!matched) {
    return { ok: false as const, status: 403, message: 'Forbidden' }
  }

  return { ok: true as const, user }
}
