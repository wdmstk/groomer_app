export type AppPlan = 'light' | 'standard' | 'pro'
export type AppOption = 'hotel' | 'notification'

const PLAN_ORDER: Record<AppPlan, number> = {
  light: 0,
  standard: 1,
  pro: 2,
}

const ROUTE_MINIMUM_PLAN: Record<string, AppPlan> = {
  '/dashboard': 'light',
  '/dashboard/appointments-kpi': 'pro',
  '/dashboard/notification-logs': 'standard',
  '/dashboard/audit-logs': 'pro',
  '/hq': 'pro',
  '/hq/menu-templates': 'pro',
  '/hq/menu-template-deliveries': 'pro',
  '/hq/hotel-menu-templates': 'pro',
  '/hq/hotel-menu-template-deliveries': 'pro',
  '/hq/manual': 'pro',
  '/manual': 'light',
  '/customers/manage': 'light',
  '/appointments': 'light',
  '/hotel': 'standard',
  '/service-menus': 'light',
  '/medical-records': 'standard',
  '/visits': 'light',
  '/inventory': 'standard',
  '/payments': 'light',
  '/settings': 'light',
  '/settings/notifications': 'standard',
  '/settings/storage': 'light',
  '/settings/public-reserve': 'light',
  '/settings/setup-store': 'light',
  '/dashboard/setup-store': 'light',
  '/staffs': 'light',
  '/attendance-punch': 'light',
  '/attendance-records': 'light',
  '/support-tickets': 'light',
  '/billing': 'light',
  '/billing/history': 'light',
}

const ROUTE_REQUIRED_OPTION: Partial<Record<string, AppOption>> = {
  '/hotel': 'hotel',
  '/hq/hotel-menu-templates': 'hotel',
  '/hq/hotel-menu-template-deliveries': 'hotel',
}

export function normalizePlanCode(planCode: string | null | undefined): AppPlan {
  const normalized = (planCode ?? '').trim().toLowerCase()
  if (['light', 'lite', 'free', 'starter'].includes(normalized)) return 'light'
  if (['pro', 'professional', 'premium'].includes(normalized)) return 'pro'
  if (['standard', 'std', 'basic'].includes(normalized)) return 'standard'
  return 'light'
}

export function canAccessRouteByPlan(route: string, planCode: string | null | undefined): boolean {
  const activePlan = normalizePlanCode(planCode)
  const requiredPlan = ROUTE_MINIMUM_PLAN[route] ?? 'light'
  return PLAN_ORDER[activePlan] >= PLAN_ORDER[requiredPlan]
}

export function isPlanAtLeast(planCode: string | null | undefined, requiredPlan: AppPlan): boolean {
  const activePlan = normalizePlanCode(planCode)
  return PLAN_ORDER[activePlan] >= PLAN_ORDER[requiredPlan]
}

export function requiredPlanForRoute(route: string): AppPlan {
  return ROUTE_MINIMUM_PLAN[route] ?? 'light'
}

export function requiredOptionForRoute(route: string): AppOption | null {
  return ROUTE_REQUIRED_OPTION[route] ?? null
}

export function optionLabel(option: AppOption): string {
  if (option === 'hotel') return 'ホテルオプション'
  return '通知強化オプション'
}

export function canPurchaseOptionsByPlan(planCode: string | null | undefined): boolean {
  return isPlanAtLeast(planCode, 'standard')
}

export function planLabel(plan: AppPlan): string {
  if (plan === 'pro') return 'プロ'
  if (plan === 'standard') return 'スタンダード'
  return 'ライト'
}
