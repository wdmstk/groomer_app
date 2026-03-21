import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'

type AssistLlmInput = {
  aiPlanCode: AiPlanCode
  petName: string
  menu: string | null
  behaviorNotes: string | null
  skinCondition: string | null
  durationSec: number | null
}

type ProLlmInput = {
  aiPlanCode: AiPlanCode
  petName: string
  behaviorNotes: string | null
  skinCondition: string | null
  tags: string[]
}

type ProPlusLlmInput = {
  aiPlanCode: AiPlanCode
  month: string
  analyzedRecords: number
  highAlertRecords: number
  highlightVideos: number
}

type AssistLlmOutput = {
  provider: string
  caption: string
  summary: string
  telops: string[]
  billing?: {
    model: string
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
    estimatedCostJpy: number | null
    retries: number
    latencyMs: number
  }
}

type ProLlmOutput = {
  provider: string
  steps: string[]
  cooperationHint: 'low' | 'medium' | 'high'
  stressHint: 'low' | 'medium' | 'high'
  draft: string
  billing?: {
    model: string
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
    estimatedCostJpy: number | null
    retries: number
    latencyMs: number
  }
}

type ProPlusLlmOutput = {
  provider: string
  summary: string
  billing?: {
    model: string
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
    estimatedCostJpy: number | null
    retries: number
    latencyMs: number
  }
}

export type LlmAdapter = {
  assist(input: AssistLlmInput): Promise<AssistLlmOutput>
  pro(input: ProLlmInput): Promise<ProLlmOutput>
  proPlus(input: ProPlusLlmInput): Promise<ProPlusLlmOutput>
}

type LlmProvider = 'mock' | 'openai'

function riskByText(text: string) {
  if (/暴れ|緊張|抵抗|震え|呼吸|赤み/.test(text)) return 'high' as const
  if (/警戒|不安|乾燥|毛玉/.test(text)) return 'medium' as const
  return 'low' as const
}

function deriveSteps(text: string) {
  const steps: string[] = []
  if (/ブラシ|もつれ|毛玉/.test(text)) steps.push('ブラッシング')
  if (/シャンプー|泡/.test(text)) steps.push('シャンプー')
  if (/ドライ|乾か/.test(text)) steps.push('ドライ')
  if (/爪/.test(text)) steps.push('爪切り')
  if (steps.length === 0) steps.push('全体施術')
  return steps
}

function mockAssist(input: AssistLlmInput): AssistLlmOutput {
  const behavior = (input.behaviorNotes ?? '').trim() || '落ち着いて施術できました'
  const skin = (input.skinCondition ?? '').trim() || '皮膚状態は安定しています'
  const menu = (input.menu ?? '').trim() || 'トリミング'
  const durationText =
    typeof input.durationSec === 'number' && Number.isFinite(input.durationSec) && input.durationSec > 0
      ? `${Math.max(10, Math.min(20, Math.floor(input.durationSec)))}秒`
      : '15秒'

  return {
    provider: 'assist_flash_mock',
    caption: `${input.petName}ちゃん ${menu}の様子`,
    summary: `${menu}の一部を${durationText}にまとめました。${skin}。${behavior}。`,
    telops: [`${menu}ダイジェスト`, skin, behavior],
  }
}

function mockPro(input: ProLlmInput): ProLlmOutput {
  const source = [input.behaviorNotes ?? '', input.skinCondition ?? '', input.tags.join(' ')].join(' ')
  const steps = deriveSteps(source)
  const stressHint = riskByText(source)
  const cooperationHint = stressHint === 'high' ? 'low' : stressHint === 'medium' ? 'medium' : 'high'
  const draft = `${input.petName}ちゃんは${steps.join('→')}の順で施術。協力度は${
    cooperationHint === 'high' ? '高め' : cooperationHint === 'medium' ? '標準' : '要配慮'
  }、ストレスは${stressHint === 'high' ? '高め' : stressHint === 'medium' ? '中程度' : '低め'}と推定。`

  return {
    provider: 'pro_vision_mock',
    steps,
    cooperationHint,
    stressHint,
    draft,
  }
}

function mockProPlus(input: ProPlusLlmInput): ProPlusLlmOutput {
  const summary =
    input.analyzedRecords === 0
      ? `${input.month}は解析データがまだありません。`
      : `${input.month}は${input.analyzedRecords}件解析し、高リスクは${input.highAlertRecords}件、ハイライト生成は${input.highlightVideos}本でした。来月は高リスク案件の再来時チェック強化を推奨します。`

  return {
    provider: 'pro_plus_sonnet_mock',
    summary,
  }
}

function resolveLlmProvider(): LlmProvider {
  const value = (process.env.AI_LLM_PROVIDER ?? 'mock').trim().toLowerCase()
  return value === 'openai' ? 'openai' : 'mock'
}

function resolveOpenAiConfig() {
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').trim()
  const assistModel = (process.env.AI_LLM_ASSIST_MODEL ?? 'gpt-4o-mini').trim()
  const proModel = (process.env.AI_LLM_PRO_MODEL ?? 'gpt-4.1').trim()
  const proPlusModel = (process.env.AI_LLM_PRO_PLUS_MODEL ?? 'gpt-4.1').trim()
  const timeoutMs = Number.parseInt(process.env.AI_LLM_TIMEOUT_MS ?? '20000', 10)
  const maxRetries = Number.parseInt(process.env.AI_LLM_MAX_RETRIES ?? '2', 10)
  const promptPriceJpyPer1k = Number.parseFloat(process.env.AI_LLM_PROMPT_PRICE_JPY_PER_1K ?? '0')
  const completionPriceJpyPer1k = Number.parseFloat(process.env.AI_LLM_COMPLETION_PRICE_JPY_PER_1K ?? '0')
  return {
    apiKey,
    baseUrl,
    assistModel,
    proModel,
    proPlusModel,
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(1000, timeoutMs) : 20000,
    maxRetries: Number.isFinite(maxRetries) ? Math.max(0, Math.min(5, maxRetries)) : 2,
    promptPriceJpyPer1k: Number.isFinite(promptPriceJpyPer1k) ? Math.max(0, promptPriceJpyPer1k) : 0,
    completionPriceJpyPer1k: Number.isFinite(completionPriceJpyPer1k) ? Math.max(0, completionPriceJpyPer1k) : 0,
  }
}

async function callOpenAiJson(params: {
  model: string
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}) {
  const config = resolveOpenAiConfig()
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY が未設定です。')
  }

  let lastError: Error | null = null
  const startedAt = Date.now()
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: typeof params.temperature === 'number' ? params.temperature : 0.2,
          max_tokens: typeof params.maxTokens === 'number' ? params.maxTokens : 500,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: { message?: string }
            choices?: Array<{ message?: { content?: string | null } }>
            usage?: {
              prompt_tokens?: number
              completion_tokens?: number
              total_tokens?: number
            }
          }
        | null
      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 429
        const error = new Error(payload?.error?.message ?? 'OpenAI APIの呼び出しに失敗しました。')
        if (!isRetryable || attempt >= config.maxRetries) {
          throw error
        }
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
        continue
      }

      const content = payload?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('OpenAI APIレスポンスのcontentが空です。')
      }
      const json = JSON.parse(content) as { [key: string]: unknown }
      const promptTokens =
        typeof payload?.usage?.prompt_tokens === 'number' && Number.isFinite(payload.usage.prompt_tokens)
          ? Math.max(0, Math.floor(payload.usage.prompt_tokens))
          : null
      const completionTokens =
        typeof payload?.usage?.completion_tokens === 'number' && Number.isFinite(payload.usage.completion_tokens)
          ? Math.max(0, Math.floor(payload.usage.completion_tokens))
          : null
      const totalTokens =
        typeof payload?.usage?.total_tokens === 'number' && Number.isFinite(payload.usage.total_tokens)
          ? Math.max(0, Math.floor(payload.usage.total_tokens))
          : null
      const estimatedCostJpy =
        promptTokens === null && completionTokens === null
          ? null
          : Number(
              (
                ((promptTokens ?? 0) / 1000) * config.promptPriceJpyPer1k +
                ((completionTokens ?? 0) / 1000) * config.completionPriceJpyPer1k
              ).toFixed(6)
            )
      return {
        json,
        billing: {
          model: params.model,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostJpy,
          retries: attempt,
          latencyMs: Date.now() - startedAt,
        },
      }
    } catch (cause) {
      const isAbortError = cause instanceof Error && cause.name === 'AbortError'
      const error = cause instanceof Error ? cause : new Error('OpenAI APIの呼び出しに失敗しました。')
      if ((!isAbortError && attempt >= config.maxRetries) || attempt >= config.maxRetries) {
        throw error
      }
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError ?? new Error('OpenAI APIの呼び出しに失敗しました。')
}

export function createLlmAdapter(): LlmAdapter {
  const provider = resolveLlmProvider()
  const openAi = resolveOpenAiConfig()

  return {
    async assist(input) {
      const plan = parseAiPlanCode(input.aiPlanCode)
      if (plan === 'none') {
        throw new Error('AI Assist以上の契約が必要です。')
      }
      if (provider === 'openai') {
        const menu = input.menu?.trim() || 'トリミング'
        const behavior = input.behaviorNotes?.trim() || '落ち着いて施術できました'
        const skin = input.skinCondition?.trim() || '皮膚状態は安定しています'
        const durationSec =
          typeof input.durationSec === 'number' && Number.isFinite(input.durationSec)
            ? Math.max(10, Math.min(20, Math.floor(input.durationSec)))
            : 15
        const response = await callOpenAiJson({
          model: openAi.assistModel,
          systemPrompt:
            'あなたはトリマー向け動画カルテ補助AIです。必ずJSONのみで回答してください。' +
            '形式: {"caption":"string","summary":"string","telops":["string","string","string"]}',
          userPrompt: JSON.stringify({
            petName: input.petName,
            menu,
            behavior,
            skin,
            durationSec,
            constraints: ['captionは短く', 'summaryは120文字以内', 'telopsは最大3件'],
          }),
          maxTokens: 400,
        })
        return {
          provider: `openai:${openAi.assistModel}`,
          caption: typeof response.json.caption === 'string' ? response.json.caption : `${input.petName}ちゃん施術ダイジェスト`,
          summary: typeof response.json.summary === 'string' ? response.json.summary : `${menu}の施術要約です。`,
          telops: Array.isArray(response.json.telops)
            ? response.json.telops.filter((value): value is string => typeof value === 'string').slice(0, 3)
            : [],
          billing: response.billing,
        }
      }
      return mockAssist(input)
    },
    async pro(input) {
      const plan = parseAiPlanCode(input.aiPlanCode)
      if (plan !== 'pro' && plan !== 'pro_plus') {
        throw new Error('AI Pro以上の契約が必要です。')
      }
      if (provider === 'openai') {
        const response = await callOpenAiJson({
          model: openAi.proModel,
          systemPrompt:
            'あなたはトリマー向け施術分析AIです。必ずJSONのみで回答してください。' +
            '形式: {"steps":["string"],"cooperationHint":"low|medium|high","stressHint":"low|medium|high","draft":"string"}',
          userPrompt: JSON.stringify({
            petName: input.petName,
            behaviorNotes: input.behaviorNotes,
            skinCondition: input.skinCondition,
            tags: input.tags,
          }),
          maxTokens: 500,
        })
        const cooperationHint = response.json.cooperationHint === 'low' || response.json.cooperationHint === 'medium' || response.json.cooperationHint === 'high'
          ? response.json.cooperationHint
          : 'medium'
        const stressHint = response.json.stressHint === 'low' || response.json.stressHint === 'medium' || response.json.stressHint === 'high'
          ? response.json.stressHint
          : 'medium'
        return {
          provider: `openai:${openAi.proModel}`,
          steps: Array.isArray(response.json.steps)
            ? response.json.steps.filter((value): value is string => typeof value === 'string').slice(0, 6)
            : [],
          cooperationHint,
          stressHint,
          draft: typeof response.json.draft === 'string' ? response.json.draft : `${input.petName}ちゃんの施術下書きです。`,
          billing: response.billing,
        }
      }
      return mockPro(input)
    },
    async proPlus(input) {
      const plan = parseAiPlanCode(input.aiPlanCode)
      if (plan !== 'pro_plus') {
        throw new Error('AI Pro+の契約が必要です。')
      }
      if (provider === 'openai') {
        const response = await callOpenAiJson({
          model: openAi.proPlusModel,
          systemPrompt:
            'あなたは店舗向け月次AIレポート生成AIです。必ずJSONのみで回答してください。' +
            '形式: {"summary":"string"}',
          userPrompt: JSON.stringify({
            month: input.month,
            analyzedRecords: input.analyzedRecords,
            highAlertRecords: input.highAlertRecords,
            highlightVideos: input.highlightVideos,
            instructions: ['事実ベース', '150文字以内', '来月の改善提案を1文入れる'],
          }),
          maxTokens: 350,
        })
        return {
          provider: `openai:${openAi.proPlusModel}`,
          summary: typeof response.json.summary === 'string' ? response.json.summary : `${input.month}の月次レポートを生成しました。`,
          billing: response.billing,
        }
      }
      return mockProPlus(input)
    },
  }
}
