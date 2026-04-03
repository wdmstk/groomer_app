import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function resolveJournalVisibilityMode(raw: string | null) {
  return raw === 'include_drafts' ? 'include_drafts' : 'published_only'
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return NextResponse.json({ message: '所属情報の取得に失敗しました。' }, { status: 403 })
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ message: 'この操作は owner/admin のみ実行できます。' }, { status: 403 })
  }

  const medicalRecordListLimit = clampInt(
    Number(formData.get('medical_record_list_limit')),
    5,
    100,
    10
  )
  const journalVisibilityMode = resolveJournalVisibilityMode(
    formData.get('journal_visibility_mode')?.toString() ?? null
  )

  const { error: upsertError } = await supabase
    .from('store_customer_management_settings' as never)
    .upsert(
      {
        store_id: storeId,
        medical_record_list_limit: medicalRecordListLimit,
        journal_visibility_mode: journalVisibilityMode,
      } as never,
      { onConflict: 'store_id' }
    )

  if (upsertError) {
    return NextResponse.json({ message: upsertError.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}
