import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { canPurchaseOptionsByPlan } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { parseAiPlanCode } from '@/lib/billing/pricing'
import { applyRequestedOptionEntitlements } from '@/lib/billing/db'
import { isDevBillingBypassEnabled } from '@/lib/billing/dev-bypass'

function redirectWithMessage(request: Request, key: 'message' | 'error', value: string) {
  const url = new URL('/billing', request.url)
  url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

export async function POST(request: Request) {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const formData = await request.formData()
  const hotelOptionEnabled =
    (formData.get('hotel_option_enabled')?.toString() ?? 'false') === 'true'
  const notificationOptionEnabled =
    (formData.get('notification_option_enabled')?.toString() ?? 'false') === 'true'
  const targetOption = formData.get('option')?.toString() ?? ''
  const aiPlanCode = parseAiPlanCode(formData.get('ai_plan_code')?.toString() ?? 'none')
  const state = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(guard.supabase),
    storeId: guard.storeId,
  })
  const admin = createAdminSupabaseClient()
  const isDevBypassEnabled = isDevBillingBypassEnabled()

  const optionContractAllowed = canPurchaseOptionsByPlan(state.planCode)
  if (!optionContractAllowed && (hotelOptionEnabled || notificationOptionEnabled)) {
    return redirectWithMessage(
      request,
      'error',
      'オプション契約はスタンダード以上のプランでのみ有効化できます。'
    )
  }

  const currentAiPlanCode = parseAiPlanCode(state.aiPlanCode)
  const nextHotelOptionRequested = targetOption === 'hotel'
    ? hotelOptionEnabled && optionContractAllowed
    : state.hotelOptionEnabled && optionContractAllowed
  const nextNotificationOptionRequested = targetOption === 'notification'
    ? notificationOptionEnabled && optionContractAllowed
    : state.notificationOptionEnabled && optionContractAllowed
  const nextAiPlanCodeRequested = targetOption === 'ai_plan' ? aiPlanCode : currentAiPlanCode

  const updatePayload =
    targetOption === 'notification'
      ? {
          notification_option_requested: nextNotificationOptionRequested,
          updated_at: new Date().toISOString(),
        }
      : targetOption === 'ai_plan'
        ? {
            ai_plan_code_requested: nextAiPlanCodeRequested,
            updated_at: new Date().toISOString(),
          }
      : {
          hotel_option_requested: nextHotelOptionRequested,
          updated_at: new Date().toISOString(),
        }

  const { error } = await admin
    .from('store_subscriptions' as never)
    .update(updatePayload as never)
    .eq('store_id', guard.storeId)

  if (error) {
    if (error.message.includes('column') && error.message.includes('_requested')) {
      return redirectWithMessage(
        request,
        'error',
        '課金ゲート移行用のDBマイグレーションが未適用です。requested/effective列を先に適用してください。'
      )
    }
    return redirectWithMessage(request, 'error', error.message)
  }
  if (isDevBypassEnabled) {
    await applyRequestedOptionEntitlements({ storeId: guard.storeId })
  }

  return redirectWithMessage(
    request,
    'message',
    targetOption === 'notification'
      ? notificationOptionEnabled
        ? isDevBypassEnabled
          ? '通知強化オプションを有効化しました（開発環境では決済をスキップします）。'
          : '通知強化オプションの申込を受け付けました。支払い確定後に有効化されます。'
        : isDevBypassEnabled
          ? '通知強化オプションを無効化しました（開発環境では決済をスキップします）。'
          : '通知強化オプションの無効化申込を受け付けました。'
      : targetOption === 'ai_plan'
        ? nextAiPlanCodeRequested === 'none'
          ? isDevBypassEnabled
            ? 'AIプランを無効化しました（開発環境では決済をスキップします）。'
            : 'AIプランの無効化申込を受け付けました。'
          : isDevBypassEnabled
            ? `AIプランを${nextAiPlanCodeRequested === 'assist' ? 'Assist' : nextAiPlanCodeRequested === 'pro' ? 'Pro' : 'Pro+'}へ変更しました（開発環境では決済をスキップします）。`
            : `AIプランを${nextAiPlanCodeRequested === 'assist' ? 'Assist' : nextAiPlanCodeRequested === 'pro' ? 'Pro' : 'Pro+'}へ変更する申込を受け付けました。支払い確定後に有効化されます。`
      : hotelOptionEnabled
        ? isDevBypassEnabled
          ? 'ホテルオプションを有効化しました（開発環境では決済をスキップします）。'
          : 'ホテルオプションの申込を受け付けました。支払い確定後に有効化されます。'
        : isDevBypassEnabled
          ? 'ホテルオプションを無効化しました（開発環境では決済をスキップします）。'
          : 'ホテルオプションの無効化申込を受け付けました。'
  )
}
