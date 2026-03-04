import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { CronServiceError } from '@/lib/cron/shared'
import { getJobRunById } from '@/lib/cron/services/job-runs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job_run_id: string }> }
) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { job_run_id: jobRunId } = await params

  try {
    const result = await getJobRunById(jobRunId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CronServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
