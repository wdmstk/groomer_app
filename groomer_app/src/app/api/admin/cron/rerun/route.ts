import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { CronServiceError } from '@/lib/cron/shared'
import { rerunCronJob } from '@/lib/cron/services/rerun'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const jobName = typeof body?.jobName === 'string' ? body.jobName.trim() : ''
  const sourceJobRunId =
    typeof body?.sourceJobRunId === 'string' && body.sourceJobRunId.trim()
      ? body.sourceJobRunId.trim()
      : null
  const reason =
    typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : null

  try {
    const result = await rerunCronJob({
      jobName,
      sourceJobRunId,
      requestedByUserId: guard.user.id,
      reason,
    })

    return NextResponse.json({
      message: 'Job rerun completed.',
      ...result,
    })
  } catch (error) {
    if (error instanceof CronServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
