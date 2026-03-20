import { NextResponse } from 'next/server'
import { finishJobRun, startJobRun } from '@/lib/cron/shared'
import { runMedicalRecordAiTagsJob } from '@/lib/cron/services/medical-record-ai-tags'

export async function GET() {
  let jobRunId: string | null = null

  try {
    jobRunId = await startJobRun({ jobName: 'medical-record-ai-tags' })
    const result = await runMedicalRecordAiTagsJob()
    await finishJobRun({ jobRunId, status: 'succeeded', meta: result })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run medical record AI tags job.'
    if (jobRunId) {
      await finishJobRun({ jobRunId, status: 'failed', lastError: message })
    }
    return NextResponse.json({ message }, { status: 500 })
  }
}
