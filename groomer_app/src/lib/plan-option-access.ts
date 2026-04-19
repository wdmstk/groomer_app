import type { AppOption } from '@/lib/subscription-plan'

export type PlanOptionState = {
  hotelOptionEnabled: boolean
  notificationOptionEnabled: boolean
}

export function hasRequiredOption(
  state: PlanOptionState,
  requiredOption: AppOption | null | undefined
): boolean {
  if (!requiredOption) return true
  if (requiredOption === 'hotel') return state.hotelOptionEnabled
  return state.notificationOptionEnabled
}

