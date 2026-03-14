import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { runNotificationUsageBillingJob } from '@/lib/cron/services/notification-usage-billing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseMonth(value: unknown) {
  if (typeof value !== 'string') return null
  const month = value.trim()
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const monthNum = Number.parseInt(month.slice(5, 7), 10)
  if (monthNum < 1 || monthNum > 12) return null
  return month
}

export async function POST(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const targetMonthJst = parseMonth(body?.targetMonthJst)
  if (!targetMonthJst) {
    return NextResponse.json({ message: 'targetMonthJst is required. format=YYYY-MM' }, { status: 400 })
  }

  const commit = body?.commit === true
  const targetStoreIds = Array.isArray(body?.targetStoreIds)
    ? body.targetStoreIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    : []

  const result = await runNotificationUsageBillingJob({
    targetMonthJst,
    dryRun: !commit,
    targetStoreIds,
  })

  return NextResponse.json({
    mode: commit ? 'commit' : 'dry_run',
    ...result,
  })
}
