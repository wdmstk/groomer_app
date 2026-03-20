import { NextResponse } from 'next/server'
import { finishJobRun, startJobRun } from '@/lib/cron/shared'
import { runMedicalRecordAiAssistJobs } from '@/lib/cron/services/medical-record-ai-assist'

export async function GET() {
  let jobRunId: string | null = null

  try {
    jobRunId = await startJobRun({ jobName: 'medical-record-ai-assist' })
    const result = await runMedicalRecordAiAssistJobs()
    await finishJobRun({ jobRunId, status: 'succeeded', meta: result })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run medical record AI assist job.'
    if (jobRunId) {
      await finishJobRun({ jobRunId, status: 'failed', lastError: message })
    }
    return NextResponse.json({ message }, { status: 500 })
  }
}

