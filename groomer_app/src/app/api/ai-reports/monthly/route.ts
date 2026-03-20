import { NextResponse } from 'next/server'
import { parseAiPlanCode } from '@/lib/billing/pricing'
import { hasAiProPlusAccess } from '@/lib/medical-records/ai-pro-plus'
import { createStoreScopedClient } from '@/lib/supabase/store'

function monthRangeJst(target: Date) {
  const y = target.getUTCFullYear()
  const m = target.getUTCMonth()
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  const to = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0))
  return {
    reportMonth: `${y}-${String(m + 1).padStart(2, '0')}`,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  }
}

export async function GET(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const url = new URL(request.url)
  const requestedMonth = url.searchParams.get('month')?.trim() ?? ''
  const reportMonth = /^\d{4}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : monthRangeJst(new Date()).reportMonth

  const { data, error } = await supabase
    .from('store_ai_monthly_reports' as never)
    .select('id, report_month, summary, metrics, generated_at')
    .eq('store_id', storeId)
    .eq('report_month', reportMonth)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json({ report: data ?? null })
}

export async function POST(_request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('ai_plan_code')
    .eq('store_id', storeId)
    .maybeSingle()
  const aiPlanCode = parseAiPlanCode((subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ?? 'none')
  if (!hasAiProPlusAccess(aiPlanCode)) {
    return NextResponse.json({ message: 'AI Pro+の契約が必要です。' }, { status: 403 })
  }

  const month = monthRangeJst(new Date())
  const [{ data: insights }, { count: generatedHighlightCount }] = await Promise.all([
    supabase
      .from('medical_record_ai_pro_plus_health_insights' as never)
      .select('gait_risk, skin_risk, tremor_risk, respiration_risk, stress_level, fatigue_level, confidence')
      .eq('store_id', storeId)
      .gte('analyzed_at', month.fromIso)
      .lt('analyzed_at', month.toIso),
    supabase
      .from('medical_record_videos' as never)
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('source_type', 'ai_generated')
      .gte('created_at', month.fromIso)
      .lt('created_at', month.toIso),
  ])

  const rows = (insights ?? []) as Array<{
    gait_risk: string | null
    skin_risk: string | null
    tremor_risk: string | null
    respiration_risk: string | null
    stress_level: string | null
    fatigue_level: string | null
    confidence: number | null
  }>
  const highAlerts = rows.filter((row) =>
    [row.gait_risk, row.skin_risk, row.tremor_risk, row.respiration_risk].some((risk) => risk === 'high')
  ).length
  const avgConfidence =
    rows.length > 0
      ? Number(
          (
            rows.reduce((sum, row) => {
              const value = typeof row.confidence === 'number' && Number.isFinite(row.confidence) ? row.confidence : 0
              return sum + value
            }, 0) / rows.length
          ).toFixed(2)
        )
      : 0
  const summary =
    rows.length === 0
      ? '今月のPro+解析データはまだありません。'
      : `今月は${rows.length}件を解析し、高リスク気づきは${highAlerts}件でした。教育ハイライト動画は${generatedHighlightCount ?? 0}本です。`

  const metrics = {
    analyzedRecords: rows.length,
    highAlertRecords: highAlerts,
    generatedHighlightVideos: generatedHighlightCount ?? 0,
    averageConfidence: avgConfidence,
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('store_ai_monthly_reports' as never)
    .upsert(
      {
        store_id: storeId,
        report_month: month.reportMonth,
        summary,
        metrics,
        generated_at: now,
        updated_at: now,
      } as never,
      { onConflict: 'store_id,report_month' }
    )
    .select('id, report_month, summary, metrics, generated_at')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    report: data,
  })
}

