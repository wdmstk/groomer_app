import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'

type RiskLevel = 'low' | 'medium' | 'high'

export type MedicalRecordAiProInput = {
  aiPlanCode: AiPlanCode
  durationMin: number | null
  behaviorNotes: string | null
  skinCondition: string | null
  tags: string[] | null
  videoCount: number
}

export type MedicalRecordAiProInsightDraft = {
  modelTier: 'pro' | 'pro_plus'
  personalityTraits: string[]
  behaviorScore: number
  cooperationScore: number
  stressScore: number
  estimatedNextDurationMin: number | null
  mattingRisk: RiskLevel
  surchargeRisk: RiskLevel
  highlightedScenes: Array<{
    type: 'before_after' | 'behavior' | 'skin_check' | 'digest'
    confidence: number
    summary: string
  }>
  confidence: number
  sourceVideoCount: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function hasWord(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export function hasAiProAccess(value: unknown): boolean {
  const plan = parseAiPlanCode(value)
  return plan === 'pro' || plan === 'pro_plus'
}

export function deriveMedicalRecordAiProInsight(input: MedicalRecordAiProInput): MedicalRecordAiProInsightDraft {
  const aiPlanCode = parseAiPlanCode(input.aiPlanCode)
  const modelTier: 'pro' | 'pro_plus' = aiPlanCode === 'pro_plus' ? 'pro_plus' : 'pro'
  const behaviorNotes = normalizeText(input.behaviorNotes)
  const skinCondition = normalizeText(input.skinCondition)
  const tags = (input.tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  const tagText = tags.join(' ')

  const personalityTraits = new Set<string>()
  if (hasWord(behaviorNotes, ['怖', '警戒', '緊張'])) personalityTraits.add('怖がり')
  if (hasWord(behaviorNotes, ['暴れ', '抵抗', '噛'])) personalityTraits.add('暴れやすい')
  if (hasWord(behaviorNotes, ['音', 'ドライヤー', 'バリカン'])) personalityTraits.add('音に敏感')
  if (personalityTraits.size === 0) personalityTraits.add('落ち着き傾向')

  let stressBase = 20
  if (hasWord(behaviorNotes, ['怖', '緊張', '暴れ'])) stressBase += 30
  if (hasWord(tagText, ['耳汚れ', '皮膚', '赤み'])) stressBase += 10
  if (input.videoCount >= 2) stressBase -= 5
  const stressScore = clamp(stressBase, 0, 100)

  let cooperationBase = 85
  cooperationBase -= hasWord(behaviorNotes, ['暴れ', '抵抗', '噛']) ? 25 : 0
  cooperationBase -= hasWord(behaviorNotes, ['怖', '緊張']) ? 10 : 0
  const cooperationScore = clamp(cooperationBase, 0, 100)

  const behaviorScore = clamp(Math.round((cooperationScore + (100 - stressScore)) / 2), 0, 100)

  const mattingSignal =
    hasWord(tagText, ['毛玉:多', '毛玉']) || hasWord(behaviorNotes, ['毛玉', 'もつれ']) ? 80 : hasWord(tagText, ['毛玉:中']) ? 55 : 20
  const mattingRisk = toRiskLevel(mattingSignal)

  const surchargeSignal =
    (input.durationMin ?? 0) >= 120 || hasWord(behaviorNotes, ['暴れ', '保定']) || mattingRisk === 'high'
      ? 75
      : mattingRisk === 'medium'
        ? 45
        : 20
  const surchargeRisk = toRiskLevel(surchargeSignal)

  const baseDuration = input.durationMin && input.durationMin > 0 ? input.durationMin : null
  let estimatedNextDurationMin = baseDuration
  if (baseDuration !== null) {
    const multiplier =
      1 +
      (mattingRisk === 'high' ? 0.22 : mattingRisk === 'medium' ? 0.1 : 0) +
      (stressScore >= 70 ? 0.12 : stressScore >= 40 ? 0.05 : 0)
    estimatedNextDurationMin = Math.max(10, Math.round(baseDuration * multiplier))
  }

  const highlightedScenes: MedicalRecordAiProInsightDraft['highlightedScenes'] = [
    { type: 'before_after', confidence: 0.82, summary: '施術前後の差分が大きいシーンを抽出' },
    {
      type: 'behavior',
      confidence: stressScore >= 60 ? 0.88 : 0.72,
      summary: stressScore >= 60 ? '緊張・抵抗が見られた場面を抽出' : '落ち着いて協力できた場面を抽出',
    },
    {
      type: 'digest',
      confidence: 0.8,
      summary: input.videoCount >= 2 ? '複数動画から主要シーンを要約' : '単一動画から主要シーンを要約',
    },
  ]

  if (skinCondition.length > 0) {
    highlightedScenes.push({
      type: 'skin_check',
      confidence: hasWord(skinCondition, ['赤み', '乾燥']) ? 0.84 : 0.68,
      summary: '皮膚コンディション確認シーンを抽出',
    })
  }

  const confidenceBase = modelTier === 'pro_plus' ? 0.9 : 0.82
  const confidence = Math.max(0.5, Math.min(0.96, confidenceBase - Math.abs(stressScore - 50) * 0.001))

  return {
    modelTier,
    personalityTraits: Array.from(personalityTraits),
    behaviorScore,
    cooperationScore,
    stressScore,
    estimatedNextDurationMin,
    mattingRisk,
    surchargeRisk,
    highlightedScenes,
    confidence: Number(confidence.toFixed(2)),
    sourceVideoCount: Math.max(0, Math.floor(input.videoCount)),
  }
}

