import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { CronServiceError } from '@/lib/cron/shared'
import { listFailedJobRuns } from '@/lib/cron/services/job-runs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const jobName = searchParams.get('jobName')
  const trigger = searchParams.get('trigger')
  const requestedByUserId = searchParams.get('requestedByUserId')
  const limitRaw = Number(searchParams.get('limit'))
  const pageRaw = Number(searchParams.get('page'))
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined
  const page = Number.isFinite(pageRaw) ? pageRaw : undefined
  const startedFrom = searchParams.get('startedFrom')
  const startedTo = searchParams.get('startedTo')

  try {
    const result = await listFailedJobRuns({
      jobName,
      trigger,
      requestedByUserId,
      limit,
      page,
      startedFrom,
      startedTo,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CronServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
