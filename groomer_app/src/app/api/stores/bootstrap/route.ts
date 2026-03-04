import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { setActiveStoreIdCookie } from '@/lib/supabase/store'
import { bootstrapStore, StoreBootstrapServiceError } from '@/lib/stores/services/bootstrap'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const storeName = typeof body?.storeName === 'string' ? body.storeName.trim() : ''
  const defaultTrialDays = Number.parseInt(process.env.DEFAULT_TRIAL_DAYS ?? '30', 10)
  const trialDays = Number.isFinite(defaultTrialDays) ? Math.max(0, defaultTrialDays) : 30

  try {
    const result = await bootstrapStore({
      storeName,
      user,
      trialDays,
    })
    await setActiveStoreIdCookie(result.storeId)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof StoreBootstrapServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : '店舗作成に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
