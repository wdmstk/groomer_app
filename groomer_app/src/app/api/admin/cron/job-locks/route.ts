import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { CronServiceError } from '@/lib/cron/shared'
import { listJobLocks, releaseJobLock } from '@/lib/cron/services/job-locks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  try {
    const result = await listJobLocks()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CronServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const jobRunId = typeof body?.jobRunId === 'string' ? body.jobRunId.trim() : ''

  try {
    const result = await releaseJobLock({
      jobRunId,
      requestedByUserId: guard.user.id,
      requestedByEmail: guard.user.email ?? null,
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
