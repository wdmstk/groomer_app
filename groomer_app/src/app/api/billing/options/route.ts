import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { canPurchaseOptionsByPlan } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { countActiveOwnerStores } from '@/lib/billing/db'
import {
  amountForPlanWithStoreCountAndOptions,
  parseBillingCycle,
} from '@/lib/billing/pricing'

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
  const state = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(guard.supabase),
    storeId: guard.storeId,
  })
  const admin = createAdminSupabaseClient()
  const { data: subscriptionRow, error: subscriptionError } = await admin
    .from('store_subscriptions')
    .select('billing_cycle')
    .eq('store_id', guard.storeId)
    .maybeSingle()

  if (subscriptionError) {
    return redirectWithMessage(request, 'error', subscriptionError.message)
  }

  const optionContractAllowed = canPurchaseOptionsByPlan(state.planCode)
  if (!optionContractAllowed && (hotelOptionEnabled || notificationOptionEnabled)) {
    return redirectWithMessage(
      request,
      'error',
      'オプション契約はスタンダード以上のプランでのみ有効化できます。'
    )
  }

  const nextHotelOptionEnabled =
    targetOption === 'hotel'
      ? hotelOptionEnabled && optionContractAllowed
      : state.hotelOptionEnabled && optionContractAllowed
  const nextNotificationOptionEnabled =
    targetOption === 'notification'
      ? notificationOptionEnabled && optionContractAllowed
      : state.notificationOptionEnabled && optionContractAllowed
  const billingCycle = parseBillingCycle(subscriptionRow?.billing_cycle)
  const ownerActiveStoreCount = await countActiveOwnerStores(guard.user.id)
  const nextAmountJpy = amountForPlanWithStoreCountAndOptions(
    state.planCode,
    billingCycle,
    ownerActiveStoreCount,
    {
      hotelOptionEnabled: nextHotelOptionEnabled,
      notificationOptionEnabled: nextNotificationOptionEnabled,
    }
  )

  const updatePayload =
    targetOption === 'notification'
      ? {
          notification_option_enabled: nextNotificationOptionEnabled,
          amount_jpy: nextAmountJpy,
          updated_at: new Date().toISOString(),
        }
      : {
          hotel_option_enabled: nextHotelOptionEnabled,
          amount_jpy: nextAmountJpy,
          updated_at: new Date().toISOString(),
        }

  const { error } = await admin
    .from('store_subscriptions')
    .update(updatePayload)
    .eq('store_id', guard.storeId)

  if (error) {
    return redirectWithMessage(request, 'error', error.message)
  }

  return redirectWithMessage(
    request,
    'message',
    targetOption === 'notification'
      ? notificationOptionEnabled
        ? '通知強化オプションを有効化しました。'
        : '通知強化オプションを無効化しました。'
      : hotelOptionEnabled
        ? 'ホテルオプションを有効化しました。'
        : 'ホテルオプションを無効化しました。'
  )
}
