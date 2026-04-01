import { NextResponse } from 'next/server'
import {
  assertAuthorizedCronRequest,
  CronServiceError,
  finishJobRun,
  startJobRun,
} from '@/lib/cron/shared'
import { runJournalLineNotificationsJob } from '@/lib/cron/services/journal-line-notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  let jobRunId: string | null = null

  try {
    assertAuthorizedCronRequest(request)
    jobRunId = await startJobRun({ jobName: 'journal-line-notifications' })
    const result = await runJournalLineNotificationsJob()
    await finishJobRun({ jobRunId, status: 'succeeded', meta: result })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CronServiceError) {
      await finishJobRun({ jobRunId, status: 'failed', lastError: error.message })
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Unexpected error'
    await finishJobRun({ jobRunId, status: 'failed', lastError: message })
    return NextResponse.json({ message }, { status: 500 })
  }
}
