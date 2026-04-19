'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { StoreSwitcher } from './StoreSwitcher'
import {
  canAccessRouteByPlan,
  normalizePlanCode,
  optionLabel,
  planLabel,
  requiredOptionForRoute,
  requiredPlanForRoute,
} from '@/lib/subscription-plan'
import { hasRequiredOption } from '@/lib/plan-option-access'
import { DEFAULT_UI_THEME, getUiThemeLabel, isUiTheme, UI_THEMES, type UiTheme } from '@/lib/ui/themes'
import { UI_THEME_STORAGE_KEY } from '@/lib/ui/theme-preference'

type StoreRole = 'owner' | 'admin' | 'staff' | ''
type NavMode = 'store' | 'hq'

type NavLink = {
  href: string
  label: string
  ownerOnly?: boolean
  ownerOrAdminOnly?: boolean
  matchStartsWith?: boolean
  attendanceFeatureOnly?: boolean
}

type NavSection = {
  title: string
  links: NavLink[]
}

const SIDEBAR_EXPANDED_SECTIONS_STORAGE_KEY = 'sidebar_expanded_sections'

const DEFAULT_OPTION_STATE = {
  hotelOptionEnabled: false,
  notificationOptionEnabled: false,
}

function resolveClientUiThemeSnapshot() {
  if (typeof window === 'undefined') return DEFAULT_UI_THEME
  const fromStorage = window.sessionStorage.getItem(UI_THEME_STORAGE_KEY)
  if (isUiTheme(fromStorage)) return fromStorage
  const fromDom = document.documentElement.dataset.theme
  if (isUiTheme(fromDom)) return fromDom
  return DEFAULT_UI_THEME
}

function parseOptionState(raw: string | null | undefined) {
  if (!raw) return DEFAULT_OPTION_STATE
  try {
    const parsed = JSON.parse(raw) as {
      hotelOptionEnabled?: boolean
      notificationOptionEnabled?: boolean
    }
    return {
      hotelOptionEnabled: parsed.hotelOptionEnabled === true,
      notificationOptionEnabled: parsed.notificationOptionEnabled === true,
    }
  } catch {
    return DEFAULT_OPTION_STATE
  }
}

const storeNavSections: NavSection[] = [
  {
    title: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード' },
      { href: '/ops/today', label: 'モバイル当日運用' },
      { href: '/attendance-punch', label: '勤怠打刻', attendanceFeatureOnly: true },
    ],
  },
  {
    title: '顧客業務',
    links: [
      { href: '/customers/manage', label: '顧客ペット管理' },
      { href: '/menu-management', label: 'メニュー管理' },
      { href: '/reservation-management', label: '予約管理' },
      { href: '/medical-records', label: 'ペットカルテ管理' },
      { href: '/journal', label: '日誌' },
      { href: '/consents?mode=customer-ops&tab=create-document', label: '電子同意書管理' },
      { href: '/visits', label: '来店履歴' },
    ],
  },
  {
    title: '在庫・会計',
    links: [
      { href: '/inventory', label: '在庫管理', matchStartsWith: true },
      { href: '/payments', label: '会計管理' },
    ],
  },
  {
    title: '運用分析',
    links: [
      { href: '/dashboard/appointments-kpi', label: 'KPIレポート' },
      { href: '/dashboard/notification-logs', label: '通知ログ' },
      { href: '/dashboard/audit-logs', label: '監査ログ' },
    ],
  },
  {
    title: '店舗管理',
    links: [
      { href: '/settings', label: '店舗設定', ownerOrAdminOnly: true, matchStartsWith: true },
      { href: '/billing', label: '決済管理', ownerOnly: true, matchStartsWith: true },
      { href: '/staffs', label: 'スタッフ管理' },
    ],
  },
  {
    title: 'その他',
    links: [
      { href: '/manual', label: 'ユーザーマニュアル' },
      { href: '/support-tickets', label: '問い合わせ' },
    ],
  },
]

const hqNavSections: NavSection[] = [
  {
    title: '本部管理',
    links: [
      { href: '/hq', label: '本部ダッシュボード', ownerOrAdminOnly: true },
      { href: '/hq/menu-templates', label: 'テンプレ配信リクエスト', ownerOnly: true },
      { href: '/hq/menu-template-deliveries', label: 'テンプレ配信承認', ownerOrAdminOnly: true },
      { href: '/hq/hotel-menu-templates', label: 'ホテルテンプレ配信リクエスト', ownerOnly: true },
      { href: '/hq/hotel-menu-template-deliveries', label: 'ホテルテンプレ配信承認', ownerOrAdminOnly: true },
      { href: '/hq/manual', label: '本部管理マニュアル', ownerOrAdminOnly: true },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLockedMenu, setShowLockedMenu] = useState(false)
  const [navMode, setNavMode] = useState<NavMode>('store')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<StoreRole>('')
  const [planCode, setPlanCode] = useState('light')
  const [optionState, setOptionState] = useState(DEFAULT_OPTION_STATE)
  const [hasOptionState, setHasOptionState] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [uiTheme, setUiTheme] = useState<UiTheme>(resolveClientUiThemeSnapshot)
  const [themeMessage, setThemeMessage] = useState('')
  const [isThemeSaving, setIsThemeSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const persistedTitle = useSyncExternalStore(
    () => () => {},
    () => (typeof window === 'undefined' ? '' : window.sessionStorage.getItem('active_store_name') ?? ''),
    () => ''
  )
  const persistedRole = useSyncExternalStore(
    () => () => {},
    () =>
      (typeof window === 'undefined'
        ? ''
        : (window.sessionStorage.getItem('active_store_role') as StoreRole | null) ?? ''),
    () => ''
  )
  const persistedUserEmail = useSyncExternalStore(
    () => () => {},
    () => (typeof window === 'undefined' ? '' : window.sessionStorage.getItem('current_user_email') ?? ''),
    () => ''
  )
  const persistedPlanCode = useSyncExternalStore(
    () => () => {},
    () => (typeof window === 'undefined' ? 'light' : window.sessionStorage.getItem('active_store_plan_code') ?? 'light'),
    () => 'light'
  )
  const persistedOptionStateRaw = useSyncExternalStore(
    () => () => {},
    () =>
      typeof window === 'undefined'
        ? ''
        : window.sessionStorage.getItem('active_store_option_state') ?? '',
    () => ''
  )
  const persistedAttendancePunchEnabled = useSyncExternalStore(
    () => () => {},
    () =>
      (typeof window === 'undefined'
        ? '1'
        : window.sessionStorage.getItem('active_store_attendance_punch_enabled') ?? '1'),
    () => '1'
  )
  const persistedOptionState = parseOptionState(persistedOptionStateRaw)
  const displayTitle = title || persistedTitle || '\u00A0'
  const activeRole = role || persistedRole || ''
  const activePlanCode = normalizePlanCode(planCode || persistedPlanCode || 'light')
  const activeOptionState = hasOptionState ? optionState : persistedOptionState
  const [attendancePunchEnabled, setAttendancePunchEnabled] = useState(true)
  const activeAttendancePunchEnabled = attendancePunchEnabled && persistedAttendancePunchEnabled !== '0'
  const displayUserEmail = userEmail || persistedUserEmail || 'メール未設定'
  const activeUiTheme: UiTheme = uiTheme
  const avatarLabel = (displayUserEmail[0] ?? '?').toUpperCase()
  const roleLabel = activeRole === 'owner' ? 'オーナー' : activeRole === 'admin' ? '管理者' : activeRole === 'staff' ? 'スタッフ' : '未設定'
  const displayPlanLabel = planLabel(activePlanCode)
  const activeOptionLabels = [
    activeOptionState.hotelOptionEnabled ? optionLabel('hotel') : null,
    activeOptionState.notificationOptionEnabled ? optionLabel('notification') : null,
  ].filter(Boolean) as string[]
  const optionSummary = activeOptionLabels.length > 0 ? activeOptionLabels.join(' / ') : 'なし'
  const hasHqAccess = activeRole === 'owner' || activeRole === 'admin'
  const activeNavMode: NavMode = hasHqAccess
    ? pathname.startsWith('/hq')
      ? 'hq'
      : navMode
    : 'store'
  const activeNavSections = activeNavMode === 'hq' ? hqNavSections : storeNavSections
  const modeLabel = activeNavMode === 'hq' ? '本部運用' : '店舗運用'

  useEffect(() => {
    const raw = window.sessionStorage.getItem(SIDEBAR_EXPANDED_SECTIONS_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>
      if (parsed && typeof parsed === 'object') {
        setExpandedSections(parsed)
      }
    } catch {
      setExpandedSections({})
    }
  }, [])

  const handleActiveStoreNameChange = useCallback((name: string) => {
    setTitle((prev) => (prev === name ? prev : name))
    window.sessionStorage.setItem('active_store_name', name)
  }, [])

  const handleActiveStoreRoleChange = useCallback((nextRole: StoreRole) => {
    setRole((prev) => (prev === nextRole ? prev : nextRole))
    window.sessionStorage.setItem('active_store_role', nextRole)
  }, [])

  const handleUserEmailChange = useCallback((email: string) => {
    setUserEmail((prev) => (prev === email ? prev : email))
    window.sessionStorage.setItem('current_user_email', email)
  }, [])

  const handleActiveStorePlanCodeChange = useCallback((nextPlanCode: string) => {
    const normalized = normalizePlanCode(nextPlanCode)
    setPlanCode((prev) => (prev === normalized ? prev : normalized))
    window.sessionStorage.setItem('active_store_plan_code', normalized)
  }, [])

  const handleActiveStoreOptionStateChange = useCallback((nextOptionState: {
    hotelOptionEnabled: boolean
    notificationOptionEnabled: boolean
  }) => {
    setHasOptionState((prev) => (prev ? prev : true))
    setOptionState((prev) =>
      prev.hotelOptionEnabled === nextOptionState.hotelOptionEnabled &&
      prev.notificationOptionEnabled === nextOptionState.notificationOptionEnabled
        ? prev
        : nextOptionState
    )
    window.sessionStorage.setItem('active_store_option_state', JSON.stringify(nextOptionState))
  }, [])

  const handleActiveAttendancePunchEnabledChange = useCallback((enabled: boolean) => {
    setAttendancePunchEnabled((prev) => (prev === enabled ? prev : enabled))
    window.sessionStorage.setItem('active_store_attendance_punch_enabled', enabled ? '1' : '0')
  }, [])

  const handleActiveUiThemeChange = useCallback((nextTheme: UiTheme) => {
    setUiTheme((prev) => (prev === nextTheme ? prev : nextTheme))
    window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }, [])

  async function saveUiTheme(nextTheme: UiTheme) {
    setThemeMessage('')
    setIsThemeSaving(true)
    setUiTheme(nextTheme)
    window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, nextTheme)
    document.documentElement.dataset.theme = nextTheme

    try {
      const response = await fetch('/api/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      })

      if (!response.ok) {
        setThemeMessage('テーマ保存に失敗しました。')
        return
      }

      setThemeMessage('テーマを保存しました。')
    } finally {
      setIsThemeSaving(false)
    }
  }

  function isLinkActive(link: NavLink) {
    const [targetPath, targetQuery = ''] = link.href.split('?')
    const currentParams = new URLSearchParams(searchParams?.toString() ?? '')
    const targetParams = new URLSearchParams(targetQuery)
    if (link.matchStartsWith) {
      if (!pathname.startsWith(targetPath)) return false
      for (const [key, value] of targetParams.entries()) {
        if (currentParams.get(key) !== value) return false
      }
      return true
    }
    if (pathname !== targetPath) return false
    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) return false
    }
    return true
  }

  function switchMode(nextMode: NavMode) {
    setNavMode(nextMode)
    if (nextMode === 'store' && pathname.startsWith('/hq')) {
      router.push('/dashboard')
      return
    }
    if (nextMode === 'hq' && !pathname.startsWith('/hq')) {
      router.push('/hq')
    }
  }

  const renderModeSwitcher = (compact = false, showReadonly = false) => {
    if (!hasHqAccess) {
      if (!showReadonly) {
        return null
      }
      return (
        <div className={compact ? '' : 'rounded border bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-900'}>
          <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 dark:text-slate-400">運用モード</p>
          <p className="rounded border bg-gray-50 px-2 py-1.5 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">店舗運用（固定）</p>
        </div>
      )
    }
    return (
      <div className={compact ? '' : 'rounded border bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-900'}>
        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 dark:text-slate-400">運用モード</p>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => switchMode('store')}
            className={`rounded px-2 py-1.5 text-xs font-semibold ${
              activeNavMode === 'store'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            店舗運用
          </button>
          <button
            type="button"
            onClick={() => switchMode('hq')}
            className={`rounded px-2 py-1.5 text-xs font-semibold ${
              activeNavMode === 'hq'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            本部運用
          </button>
        </div>
      </div>
    )
  }

  const renderLinks = (onNavigate?: () => void) => (
    <nav className="space-y-3">
      {activeNavSections.map((section) => {
        const sectionKey = `${activeNavMode}:${section.title}`
        const hasActiveLink = section.links.some((link) => isLinkActive(link))
        const isExpanded = expandedSections[sectionKey] ?? hasActiveLink
        return (
          <section key={section.title} className="rounded-xl border bg-gray-50 p-2">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedSections((prev) => {
                  const current = prev[sectionKey] ?? hasActiveLink
                  const next = {
                    ...prev,
                    [sectionKey]: !current,
                  }
                  window.sessionStorage.setItem(SIDEBAR_EXPANDED_SECTIONS_STORAGE_KEY, JSON.stringify(next))
                  return next
                })
              }
              className={`flex w-full items-center justify-between rounded-md border-l-4 border bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                hasActiveLink ? 'shadow-sm' : 'border-l-gray-300'
              }`}
              style={
                hasActiveLink
                  ? {
                      borderLeftColor: 'var(--button-primary-bg)',
                      backgroundColor: 'var(--accent-soft-bg)',
                      color: 'var(--accent-soft-text)',
                    }
                  : undefined
              }
            >
              <span
                className="text-xs font-bold tracking-wide text-gray-600"
                style={hasActiveLink ? { color: 'var(--accent-soft-text)' } : undefined}
              >
                {section.title}
              </span>
              <span
                aria-hidden="true"
                className={`text-xs font-semibold text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                style={hasActiveLink ? { color: 'var(--accent-soft-text)' } : undefined}
              >
                ▼
              </span>
            </button>
            {isExpanded ? (
              <div className="mt-2 space-y-1.5 pl-4">
                {section.links.map((link) => {
                  if (link.attendanceFeatureOnly && !activeAttendancePunchEnabled) {
                    return null
                  }
                  if (link.ownerOnly && activeRole !== 'owner') {
                    return null
                  }
                  if (link.ownerOrAdminOnly && activeRole !== 'owner' && activeRole !== 'admin') {
                    return null
                  }
                  const canAccess = canAccessRouteByPlan(link.href, activePlanCode)
                  const requiredOption = requiredOptionForRoute(link.href)
                  const canOpen = canAccess && hasRequiredOption(activeOptionState, requiredOption)
                  if (!canOpen && !showLockedMenu) {
                    return null
                  }
                  if (!canOpen) {
                    const requiredPlan = planLabel(requiredPlanForRoute(link.href))
                    const lockReason = !canAccess
                      ? requiredPlan
                      : optionLabel(requiredOption!)
                    return (
                      <div
                        key={link.href}
                        className="flex min-h-10 items-center justify-between rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500"
                      >
                        <span className="font-medium">{link.label}</span>
                        <span className="rounded border bg-white px-2 py-0.5 text-xs font-semibold">{lockReason}</span>
                      </div>
                    )
                  }
                  const isActive = isLinkActive(link)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      className={`group flex min-h-10 items-center rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'border-l-4 bg-blue-100 pl-[10px] text-blue-700 shadow-sm'
                          : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      style={isActive ? { borderLeftColor: 'var(--button-primary-bg)' } : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className={`mr-2 h-1.5 w-1.5 rounded-full transition-colors ${
                          isActive ? 'bg-blue-700' : 'bg-gray-400 group-hover:bg-gray-500'
                        }`}
                      />
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </section>
        )
      })}
      <button
        type="button"
        onClick={() => setShowLockedMenu((prev) => !prev)}
        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-left text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
      >
        {showLockedMenu ? '制限メニューを隠す' : '制限メニューを表示'}
      </button>
    </nav>
  )

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 h-20 border-b backdrop-blur"
        style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="メニューを開く"
              onClick={() => setIsOpen(true)}
              className="rounded border px-3 py-2 text-sm font-medium text-gray-700 lg:hidden"
            >
              メニュー
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[var(--text-primary)] lg:text-lg">{displayTitle}</h2>
              <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">
                {modeLabel} / {roleLabel} / {displayPlanLabel}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <StoreSwitcher
              compact
              className="w-56"
              onActiveStoreNameChange={handleActiveStoreNameChange}
              onActiveStoreRoleChange={handleActiveStoreRoleChange}
              onActiveStorePlanCodeChange={handleActiveStorePlanCodeChange}
              onActiveStoreOptionStateChange={handleActiveStoreOptionStateChange}
              onActiveAttendancePunchEnabledChange={handleActiveAttendancePunchEnabledChange}
              onActiveUiThemeChange={handleActiveUiThemeChange}
              onUserEmailChange={handleUserEmailChange}
            />
            <div className="w-44">{renderModeSwitcher(true)}</div>
            <button
              type="button"
              aria-label="プロフィールを開く"
              onClick={() => setIsProfileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold text-gray-700"
            >
              {avatarLabel}
            </button>
            <Link
              href="/logout"
              className="rounded border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              ログアウト
            </Link>
          </div>

          <button
            type="button"
            aria-label="プロフィールを開く"
            onClick={() => setIsProfileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold text-gray-700 lg:hidden"
          >
            {avatarLabel}
          </button>
        </div>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 border-r bg-white p-4 pt-20 lg:sticky lg:top-0 lg:block lg:overflow-y-auto">
        <div className="mt-2">
          {renderLinks()}
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white p-4 shadow-xl md:w-80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="max-w-[65%] truncate text-xl font-bold">{displayTitle}</h2>
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={() => setIsOpen(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                閉じる
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {renderLinks(() => setIsOpen(false))}
            </div>
          </aside>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="プロフィールを閉じる"
            onClick={() => setIsProfileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <section className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl lg:left-auto lg:right-6 lg:top-20 lg:w-96 lg:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">アカウント</h3>
              <button
                type="button"
                aria-label="プロフィールを閉じる"
                onClick={() => setIsProfileOpen(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                閉じる
              </button>
            </div>
            <div className="rounded border bg-gray-50 p-4">
              <p className="text-xs font-semibold tracking-wide text-gray-500">アカウント</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{displayUserEmail}</p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">ロール</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{roleLabel}</p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">プラン</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{displayPlanLabel}</p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">契約オプション</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{optionSummary}</p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">運用モード</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{modeLabel}</p>
            </div>
            <div className="mt-3 space-y-3 rounded border bg-white p-3">
              <StoreSwitcher
                compact
                showUnavailableState
                onActiveStoreNameChange={handleActiveStoreNameChange}
                onActiveStoreRoleChange={handleActiveStoreRoleChange}
                onActiveStorePlanCodeChange={handleActiveStorePlanCodeChange}
                onActiveStoreOptionStateChange={handleActiveStoreOptionStateChange}
                onActiveAttendancePunchEnabledChange={handleActiveAttendancePunchEnabledChange}
                onActiveUiThemeChange={handleActiveUiThemeChange}
                onUserEmailChange={handleUserEmailChange}
              />
              {renderModeSwitcher(false, true)}
              <div className="rounded border bg-gray-50 p-3">
                <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500">表示テーマ</p>
                <select
                  value={activeUiTheme}
                  className="w-full rounded border bg-white p-2 text-sm"
                  onChange={(event) => {
                    const nextTheme = event.target.value as UiTheme
                    if ((UI_THEMES as readonly string[]).includes(nextTheme)) {
                      void saveUiTheme(nextTheme)
                    }
                  }}
                  disabled={isThemeSaving}
                >
                  {UI_THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {getUiThemeLabel(theme)}
                    </option>
                  ))}
                </select>
                {themeMessage ? (
                  <p className="mt-2 text-xs font-semibold text-blue-700">{themeMessage}</p>
                ) : null}
              </div>
            </div>
            <Link
              href="/logout"
              onClick={() => setIsProfileOpen(false)}
              className="mt-3 block rounded p-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              ログアウト
            </Link>
          </section>
        </div>
      )}
    </>
  )
}

