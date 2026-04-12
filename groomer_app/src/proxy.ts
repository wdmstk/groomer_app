import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/', '/lp', '/login', '/signup', '/reserve', '/invite', '/shared', '/legal']
const billingExemptPaths = ['/billing-required', '/billing', '/logout', '/dev']
const ACTIVE_STORE_COOKIE = 'active_store_id'
const MEMBER_PORTAL_API_PREFIX = '/api/public/member-portal/'
const RATE_LIMIT_WINDOW_MS = 60_000
const MEMBER_PORTAL_RATE_LIMIT_IP = 60
const MEMBER_PORTAL_RATE_LIMIT_IP_TOKEN = 10

type RateLimitBucket = {
  startedAt: number
  count: number
}

const rateLimitByIp = new Map<string, RateLimitBucket>()
const rateLimitByIpToken = new Map<string, RateLimitBucket>()

type MembershipRow = {
  store_id: string
  role: 'owner' | 'admin' | 'staff'
}

type StoreRow = {
  id: string
  created_at: string
}

type StoreSubscriptionRow = {
  billing_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'
  trial_days: number | null
  trial_started_at: string | null
  grace_days: number | null
  past_due_since: string | null
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isBillingExemptPath(pathname: string) {
  return billingExemptPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function resolveClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function parseMemberPortalToken(pathname: string) {
  if (!pathname.startsWith(MEMBER_PORTAL_API_PREFIX)) return null
  const suffix = pathname.slice(MEMBER_PORTAL_API_PREFIX.length)
  const segments = suffix.split('/').filter(Boolean)
  const token = segments[0] ?? ''
  return token || null
}

function touchRateLimitBucket(
  key: string,
  limit: number,
  nowMs: number,
  map: Map<string, RateLimitBucket>
) {
  const existing = map.get(key)
  if (!existing || nowMs - existing.startedAt >= RATE_LIMIT_WINDOW_MS) {
    map.set(key, { startedAt: nowMs, count: 1 })
    return { allowed: true, remaining: Math.max(0, limit - 1) }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  existing.count += 1
  map.set(key, existing)
  return { allowed: true, remaining: Math.max(0, limit - existing.count) }
}

function pruneRateLimitMap(map: Map<string, RateLimitBucket>, nowMs: number) {
  for (const [key, value] of map.entries()) {
    if (nowMs - value.startedAt >= RATE_LIMIT_WINDOW_MS * 2) {
      map.delete(key)
    }
  }
}

function handleMemberPortalRateLimit(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const token = parseMemberPortalToken(pathname)
  if (!token) return null

  const nowMs = Date.now()
  pruneRateLimitMap(rateLimitByIp, nowMs)
  pruneRateLimitMap(rateLimitByIpToken, nowMs)

  const ip = resolveClientIp(req)
  const ipWindow = touchRateLimitBucket(ip, MEMBER_PORTAL_RATE_LIMIT_IP, nowMs, rateLimitByIp)
  if (!ipWindow.allowed) {
    return NextResponse.json(
      { message: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(MEMBER_PORTAL_RATE_LIMIT_IP),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Window-Seconds': '60',
        },
      }
    )
  }

  const ipTokenKey = `${ip}:${token}`
  const ipTokenWindow = touchRateLimitBucket(
    ipTokenKey,
    MEMBER_PORTAL_RATE_LIMIT_IP_TOKEN,
    nowMs,
    rateLimitByIpToken
  )
  if (!ipTokenWindow.allowed) {
    return NextResponse.json(
      { message: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(MEMBER_PORTAL_RATE_LIMIT_IP_TOKEN),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Window-Seconds': '60',
        },
      }
    )
  }

  return null
}

async function fetchPostgrest<T>(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) return null
  const data = (await response.json().catch(() => null)) as T | null
  return data
}

async function shouldBlockBySubscription(req: NextRequest, userId: string) {
  const memberships = await fetchPostgrest<MembershipRow[]>(
    `store_memberships?select=store_id,role&user_id=eq.${userId}&is_active=eq.true&order=created_at.asc`
  )

  if (!memberships || memberships.length === 0) return false

  const activeStoreIdFromCookie = req.cookies.get(ACTIVE_STORE_COOKIE)?.value ?? null
  const prioritizedMembership =
    memberships.find((item) => item.store_id === activeStoreIdFromCookie) ??
    memberships.find((item) => item.role === 'owner') ??
    memberships.find((item) => item.role === 'admin') ??
    memberships[0]

  if (!prioritizedMembership?.store_id) return false

  const storeId = prioritizedMembership.store_id
  const [storeRows, subscriptionRows] = await Promise.all([
    fetchPostgrest<StoreRow[]>(`stores?select=id,created_at&id=eq.${storeId}&limit=1`),
    fetchPostgrest<StoreSubscriptionRow[]>(
      `store_subscriptions?select=billing_status,trial_days,trial_started_at,grace_days,past_due_since&store_id=eq.${storeId}&limit=1`
    ),
  ])

  const store = storeRows?.[0]
  if (!store) return false

  const subscription = subscriptionRows?.[0]
  if (subscription?.billing_status === 'active') return false

  if (subscription?.billing_status === 'past_due') {
    const defaultGraceDays = Number.parseInt(process.env.DEFAULT_PAST_DUE_GRACE_DAYS ?? '3', 10)
    const graceDays = Number.isFinite(subscription.grace_days ?? NaN)
      ? Math.max(0, Number(subscription.grace_days ?? 0))
      : Number.isFinite(defaultGraceDays)
        ? Math.max(0, defaultGraceDays)
        : 3
    const pastDueSince = toDateOnly(subscription.past_due_since) ?? toDateOnly(new Date().toISOString())
    if (!pastDueSince) return true
    const graceEnd = addDays(pastDueSince, graceDays)
    const today = toDateOnly(new Date().toISOString()) ?? new Date()
    return today >= graceEnd
  }

  const defaultTrialDays = Number.parseInt(process.env.DEFAULT_TRIAL_DAYS ?? '30', 10)
  const trialDays = Number.isFinite(subscription?.trial_days ?? NaN)
    ? Math.max(0, Number(subscription?.trial_days ?? 0))
    : Number.isFinite(defaultTrialDays)
      ? Math.max(0, defaultTrialDays)
      : 30

  const trialStart =
    toDateOnly(subscription?.trial_started_at) ?? toDateOnly(store.created_at) ?? new Date()
  const trialEnd = addDays(trialStart, trialDays)
  const today = toDateOnly(new Date().toISOString()) ?? new Date()

  return today >= trialEnd
}

export async function proxy(req: NextRequest) {
  const isPlaywrightE2E =
    process.env.PLAYWRIGHT_E2E === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_E2E === '1'

  if (isPlaywrightE2E) {
    return NextResponse.next({
      request: {
        headers: req.headers,
      },
    })
  }

  const memberPortalRateLimitResponse = handleMemberPortalRateLimit(req)
  if (memberPortalRateLimitResponse) {
    return memberPortalRateLimitResponse
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl
  const isMemberPortalApi = pathname.startsWith(MEMBER_PORTAL_API_PREFIX)
  if (isMemberPortalApi) {
    return res
  }

  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const isInvitePath = pathname === '/invite' || pathname.startsWith('/invite/')
  const isLegalPath = pathname === '/legal' || pathname.startsWith('/legal/')
  const isReservePath = pathname === '/reserve' || pathname.startsWith('/reserve/')
  const isBillingExempt = isBillingExemptPath(pathname)

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (user) {
    const shouldEvaluateSubscription =
      !isBillingExempt || pathname === '/billing-required'
    const blockedBySubscription = shouldEvaluateSubscription
      ? await shouldBlockBySubscription(req, user.id)
      : false

    if (blockedBySubscription && !isBillingExempt) {
      return NextResponse.redirect(new URL('/billing-required', req.url))
    }
    if (!blockedBySubscription && pathname === '/billing-required') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  if (user && isPublicPath && !isInvitePath && !isLegalPath && !isReservePath) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/api/public/member-portal/:path*',
  ],
}
