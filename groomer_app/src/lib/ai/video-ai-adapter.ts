import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'

export type VideoHighlightSegment = {
  label: 'brushing' | 'nail' | 'drying'
  startSec: number
  endSec: number
  confidence: number
}

export type VideoAiAdapter = {
  extractHighlights(input: {
    aiPlanCode: AiPlanCode
    durationSec: number
  }): Promise<{
    provider: string
    segments: VideoHighlightSegment[]
    billing?: {
      estimatedCostJpy: number | null
      retries: number
      latencyMs: number
    }
  }>
  generateShortVideo(input: {
    aiPlanCode: AiPlanCode
    sourcePath: string
    durationSec: number
  }): Promise<{
    provider: string
    startSec: number
    durationSec: number
    billing?: {
      estimatedCostJpy: number | null
      retries: number
      latencyMs: number
    }
  }>
}

type VideoAiProvider = 'mock' | 'external'

function assertProPlus(value: AiPlanCode) {
  if (parseAiPlanCode(value) !== 'pro_plus') {
    throw new Error('動画AIはAI Pro+でのみ利用できます。')
  }
}

function resolveVideoAiProvider(): VideoAiProvider {
  const value = (process.env.VIDEO_AI_PROVIDER ?? 'mock').trim().toLowerCase()
  return value === 'external' ? 'external' : 'mock'
}

function resolveVideoAiConfig() {
  const timeoutMs = Number.parseInt(process.env.VIDEO_AI_TIMEOUT_MS ?? '25000', 10)
  const maxRetries = Number.parseInt(process.env.VIDEO_AI_MAX_RETRIES ?? '2', 10)
  return {
    apiKey: (process.env.VIDEO_AI_API_KEY ?? '').trim(),
    extractHighlightsUrl: (process.env.VIDEO_AI_EXTRACT_HIGHLIGHTS_URL ?? '').trim(),
    generateShortUrl: (process.env.VIDEO_AI_GENERATE_SHORT_URL ?? '').trim(),
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(1000, timeoutMs) : 25000,
    maxRetries: Number.isFinite(maxRetries) ? Math.max(0, Math.min(5, maxRetries)) : 2,
  }
}

async function callVideoAi<T>(params: {
  url: string
  apiKey: string
  timeoutMs: number
  maxRetries: number
  payload: { [key: string]: unknown }
}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (params.apiKey) {
    headers.authorization = `Bearer ${params.apiKey}`
  }

  let lastError: Error | null = null
  const startedAt = Date.now()
  for (let attempt = 0; attempt <= params.maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
    try {
      const response = await fetch(params.url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(params.payload),
      })
      const json = (await response.json().catch(() => null)) as
        | {
            message?: string
            error?: { message?: string }
            [key: string]: unknown
          }
        | null

      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 429
        const error = new Error(json?.message ?? json?.error?.message ?? '動画AI APIの呼び出しに失敗しました。')
        if (!isRetryable || attempt >= params.maxRetries) {
          throw error
        }
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
        continue
      }
      return {
        payload: (json ?? {}) as T,
        retries: attempt,
        latencyMs: Date.now() - startedAt,
      }
    } catch (cause) {
      const isAbortError = cause instanceof Error && cause.name === 'AbortError'
      const error = cause instanceof Error ? cause : new Error('動画AI APIの呼び出しに失敗しました。')
      if ((!isAbortError && attempt >= params.maxRetries) || attempt >= params.maxRetries) {
        throw error
      }
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError ?? new Error('動画AI APIの呼び出しに失敗しました。')
}

export function createVideoAiAdapter(): VideoAiAdapter {
  const provider = resolveVideoAiProvider()
  const config = resolveVideoAiConfig()

  return {
    async extractHighlights(input) {
      assertProPlus(input.aiPlanCode)
      if (provider === 'external') {
        if (!config.extractHighlightsUrl) {
          throw new Error('VIDEO_AI_EXTRACT_HIGHLIGHTS_URL が未設定です。')
        }
        const response = await callVideoAi<{
          provider?: string
          estimatedCostJpy?: number
          usage?: { estimatedCostJpy?: number }
          segments?: Array<{
            label?: string
            startSec?: number
            endSec?: number
            confidence?: number
          }>
        }>({
          url: config.extractHighlightsUrl,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
          maxRetries: config.maxRetries,
          payload: {
            durationSec: input.durationSec,
          },
        })
        const segments = Array.isArray(response.payload.segments)
          ? response.payload.segments
              .map((segment) => {
                const label = segment.label === 'brushing' || segment.label === 'nail' || segment.label === 'drying'
                  ? segment.label
                  : null
                if (!label) return null
                const startSec = typeof segment.startSec === 'number' && Number.isFinite(segment.startSec)
                  ? Math.max(0, Math.floor(segment.startSec))
                  : 0
                const endSec = typeof segment.endSec === 'number' && Number.isFinite(segment.endSec)
                  ? Math.max(startSec + 1, Math.floor(segment.endSec))
                  : startSec + 5
                const confidence = typeof segment.confidence === 'number' && Number.isFinite(segment.confidence)
                  ? Math.max(0, Math.min(1, segment.confidence))
                  : 0.5
                return { label, startSec, endSec, confidence }
              })
              .filter((segment): segment is VideoHighlightSegment => Boolean(segment))
          : []
        const estimatedCostJpy =
          typeof response.payload.estimatedCostJpy === 'number' && Number.isFinite(response.payload.estimatedCostJpy)
            ? response.payload.estimatedCostJpy
            : typeof response.payload.usage?.estimatedCostJpy === 'number' && Number.isFinite(response.payload.usage.estimatedCostJpy)
              ? response.payload.usage.estimatedCostJpy
              : null
        return {
          provider: typeof response.payload.provider === 'string' ? response.payload.provider : 'video_ai_external',
          segments,
          billing: {
            estimatedCostJpy,
            retries: response.retries,
            latencyMs: response.latencyMs,
          },
        }
      }
      const duration = Math.max(1, Math.floor(input.durationSec || 20))
      const end = Math.min(duration, 20)
      return {
        provider: 'video_ai_mock',
        segments: [
          { label: 'brushing', startSec: 0, endSec: Math.max(6, Math.min(10, end)), confidence: 0.78 },
          { label: 'nail', startSec: Math.max(0, end - 8), endSec: end, confidence: 0.72 },
          { label: 'drying', startSec: Math.max(0, end - 5), endSec: end, confidence: 0.81 },
        ],
      }
    },
    async generateShortVideo(input) {
      assertProPlus(input.aiPlanCode)
      if (provider === 'external') {
        if (!config.generateShortUrl) {
          throw new Error('VIDEO_AI_GENERATE_SHORT_URL が未設定です。')
        }
        const response = await callVideoAi<{
          provider?: string
          estimatedCostJpy?: number
          usage?: { estimatedCostJpy?: number }
          startSec?: number
          durationSec?: number
        }>({
          url: config.generateShortUrl,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
          maxRetries: config.maxRetries,
          payload: {
            sourcePath: input.sourcePath,
            durationSec: input.durationSec,
          },
        })
        const estimatedCostJpy =
          typeof response.payload.estimatedCostJpy === 'number' && Number.isFinite(response.payload.estimatedCostJpy)
            ? response.payload.estimatedCostJpy
            : typeof response.payload.usage?.estimatedCostJpy === 'number' && Number.isFinite(response.payload.usage.estimatedCostJpy)
              ? response.payload.usage.estimatedCostJpy
              : null
        return {
          provider: typeof response.payload.provider === 'string' ? response.payload.provider : 'video_ai_external',
          startSec:
            typeof response.payload.startSec === 'number' && Number.isFinite(response.payload.startSec)
              ? Math.max(0, Math.floor(response.payload.startSec))
              : 0,
          durationSec:
            typeof response.payload.durationSec === 'number' && Number.isFinite(response.payload.durationSec)
              ? Math.max(5, Math.min(20, Math.floor(response.payload.durationSec)))
              : 20,
          billing: {
            estimatedCostJpy,
            retries: response.retries,
            latencyMs: response.latencyMs,
          },
        }
      }
      const duration = Math.max(5, Math.min(20, Math.floor(input.durationSec || 20)))
      return {
        provider: 'video_ai_mock',
        startSec: 0,
        durationSec: duration,
      }
    },
  }
}
