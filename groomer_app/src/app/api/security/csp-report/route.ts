import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input) as unknown
  } catch {
    return null
  }
}

type CspLikeReport = {
  'document-uri'?: unknown
  'violated-directive'?: unknown
  'effective-directive'?: unknown
  'blocked-uri'?: unknown
  'source-file'?: unknown
  'line-number'?: unknown
  'column-number'?: unknown
  disposition?: unknown
  referrer?: unknown
  'status-code'?: unknown
  [key: string]: unknown
}

function toText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : null
}

function toInt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10)
  return null
}

function extractCspReport(payload: unknown): CspLikeReport | null {
  if (!payload || typeof payload !== 'object') return null

  // Legacy format: {"csp-report": {...}}
  if ('csp-report' in payload) {
    const report = (payload as { 'csp-report'?: unknown })['csp-report']
    if (report && typeof report === 'object') {
      return report as CspLikeReport
    }
    return null
  }

  // Reporting API format: [{ body: {...}, ... }]
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0]
    if (first && typeof first === 'object' && 'body' in first) {
      const body = (first as { body?: unknown }).body
      if (body && typeof body === 'object') {
        return body as CspLikeReport
      }
    }
    return null
  }

  // Direct object fallback
  return payload as CspLikeReport
}

export async function POST(request: Request) {
  const raw = await request.text()
  const payload = safeJsonParse(raw)
  const report = extractCspReport(payload)
  const userAgent = request.headers.get('user-agent')

  try {
    if (!report) {
      console.warn('csp_report_invalid_payload', {
        contentType: request.headers.get('content-type') ?? 'unknown',
      })
      return new NextResponse(null, { status: 204 })
    }

    const admin = createAdminSupabaseClient()
    const payload: Database['public']['Tables']['security_csp_reports']['Insert'] = {
      document_uri: toText(report['document-uri']),
      violated_directive: toText(report['violated-directive']),
      effective_directive: toText(report['effective-directive']),
      blocked_uri: toText(report['blocked-uri']),
      source_file: toText(report['source-file']),
      line_number: toInt(report['line-number']),
      column_number: toInt(report['column-number']),
      disposition: toText(report.disposition),
      referrer: toText(report.referrer),
      status_code: toInt(report['status-code']),
      user_agent: toText(userAgent),
    }

    const { error } = await admin.from('security_csp_reports').insert(payload)

    if (error) {
      console.error('failed_to_insert_csp_report', { message: error.message })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('failed_to_process_csp_report', { message })
  }

  return new NextResponse(null, { status: 204 })
}
