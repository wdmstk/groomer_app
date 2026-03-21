import { NextResponse } from 'next/server'
import { finishJobRun, startJobRun } from '@/lib/cron/shared'
import { runMedicalRecordAiVideoPipeline } from '@/lib/cron/services/medical-record-ai-video'

export async function GET() {
  let jobRunId: string | null = null

  try {
    jobRunId = await startJobRun({ jobName: 'medical-record-ai-video' })
    const result = await runMedicalRecordAiVideoPipeline()
    await finishJobRun({ jobRunId, status: 'succeeded', meta: result })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run medical record AI video job.'
    if (jobRunId) {
      await finishJobRun({ jobRunId, status: 'failed', lastError: message })
    }
    return NextResponse.json({ message }, { status: 500 })
  }
}
