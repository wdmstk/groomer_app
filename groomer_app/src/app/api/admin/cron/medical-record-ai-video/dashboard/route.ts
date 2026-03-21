import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { CronServiceError } from '@/lib/cron/shared'
import { getMedicalRecordAiVideoDashboard } from '@/lib/cron/services/medical-record-ai-video-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined

  try {
    const result = await getMedicalRecordAiVideoDashboard({ limit })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CronServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
