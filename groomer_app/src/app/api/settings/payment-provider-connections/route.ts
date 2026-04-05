import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { asObjectOrNull } from '@/lib/object-utils'

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown): ProviderType | null {
  if (value === 'stripe' || value === 'komoju') return value
  return null
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false
  }
  return fallback
}

function sanitizeSecret(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function toPublicRow(row: {
  provider: ProviderType
  is_active: boolean
  secret_key: string | null
  webhook_secret: string | null
  komoju_api_base_url: string | null
}) {
  return {
    provider: row.provider,
    is_active: row.is_active,
    has_secret_key: Boolean(row.secret_key),
    has_webhook_secret: Boolean(row.webhook_secret),
    komoju_api_base_url: row.provider === 'komoju' ? row.komoju_api_base_url : null,
  }
}

async function requireOwnerOrAdminContext() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return {
      ok: false as const,
      status: 403,
      message: membershipError?.message ?? '所属情報の取得に失敗しました。',
    }
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      message: 'この操作は owner/admin のみ実行できます。',
    }
  }

  return { ok: true as const, storeId, userId: user.id }
}

export async function GET() {
  const guard = await requireOwnerOrAdminContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_payment_provider_connections' as never)
    .select('provider, is_active, secret_key, webhook_secret, komoju_api_base_url')
    .eq('store_id', guard.storeId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Array<{
    provider: ProviderType
    is_active: boolean
    secret_key: string | null
    webhook_secret: string | null
    komoju_api_base_url: string | null
  }>
  const byProvider = new Map(rows.map((row) => [row.provider, row]))
  const normalized = (['stripe', 'komoju'] as ProviderType[]).map((provider) =>
    toPublicRow(
      byProvider.get(provider) ?? {
        provider,
        is_active: false,
        secret_key: null,
        webhook_secret: null,
        komoju_api_base_url: null,
      }
    )
  )

  return NextResponse.json({ connections: normalized })
}

export async function POST(request: Request) {
  const guard = await requireOwnerOrAdminContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  const provider = parseProvider(body?.provider)
  if (!provider) {
    return NextResponse.json({ message: 'provider must be stripe or komoju.' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data: existing, error: existingError } = await admin
    .from('store_payment_provider_connections' as never)
    .select('secret_key, webhook_secret, komoju_api_base_url, is_active')
    .eq('store_id', guard.storeId)
    .eq('provider', provider)
    .maybeSingle()
  if (existingError) {
    return NextResponse.json({ message: existingError.message }, { status: 500 })
  }

  const existingRow = (existing ?? null) as {
    secret_key: string | null
    webhook_secret: string | null
    komoju_api_base_url: string | null
    is_active: boolean
  } | null

  const incomingSecretKey = sanitizeSecret(body?.secret_key)
  const incomingWebhookSecret = sanitizeSecret(body?.webhook_secret)
  const incomingApiBase = sanitizeSecret(body?.komoju_api_base_url)

  const payload = {
    store_id: guard.storeId,
    provider,
    is_active: parseBoolean(body?.is_active, existingRow?.is_active ?? false),
    secret_key: incomingSecretKey ?? existingRow?.secret_key ?? null,
    webhook_secret: incomingWebhookSecret ?? existingRow?.webhook_secret ?? null,
    komoju_api_base_url:
      provider === 'komoju'
        ? incomingApiBase ?? existingRow?.komoju_api_base_url ?? null
        : null,
    updated_by_user_id: guard.userId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('store_payment_provider_connections' as never)
    .upsert(payload, { onConflict: 'store_id,provider' })
    .select('provider, is_active, secret_key, webhook_secret, komoju_api_base_url')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connection: toPublicRow(data as {
    provider: ProviderType
    is_active: boolean
    secret_key: string | null
    webhook_secret: string | null
    komoju_api_base_url: string | null
  }) })
}
