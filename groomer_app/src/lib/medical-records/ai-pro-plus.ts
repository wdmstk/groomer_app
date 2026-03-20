import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'

type RiskLevel = 'low' | 'medium' | 'high'

export type MedicalRecordAiProPlusInput = {
  aiPlanCode: AiPlanCode
  behaviorNotes: string | null
  skinCondition: string | null
  tags: string[] | null
  durationSec: number | null
}

export type MedicalRecordAiProPlusHealthInsightDraft = {
  gaitRisk: RiskLevel
  skinRisk: RiskLevel
  tremorRisk: RiskLevel
  respirationRisk: RiskLevel
  stressLevel: RiskLevel
  fatigueLevel: RiskLevel
  summary: string
  confidence: number
}

function hasWord(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function hasAiProPlusAccess(value: unknown): boolean {
  return parseAiPlanCode(value) === 'pro_plus'
}

export function deriveMedicalRecordAiProPlusHealthInsight(
  input: MedicalRecordAiProPlusInput
): MedicalRecordAiProPlusHealthInsightDraft {
  const behavior = (input.behaviorNotes ?? '').trim()
  const skin = (input.skinCondition ?? '').trim()
  const tags = (input.tags ?? []).join(' ')
  const durationSec = typeof input.durationSec === 'number' && Number.isFinite(input.durationSec)
    ? Math.max(0, Math.floor(input.durationSec))
    : 0

  const gaitSignal = hasWord(behavior, ['歩行', 'ふらつ', '足']) ? 75 : 25
  const skinSignal =
    hasWord(skin, ['赤み', '荒れ', '湿疹']) || hasWord(tags, ['皮膚状態:赤み'])
      ? 78
      : hasWord(skin, ['乾燥']) || hasWord(tags, ['皮膚状態:乾燥'])
        ? 52
        : 22
  const tremorSignal = hasWord(behavior, ['震え', '震']) ? 74 : 18
  const respirationSignal = hasWord(behavior, ['呼吸', 'ハァ', 'パンティング']) ? 72 : 20
  const stressSignal = hasWord(behavior, ['緊張', '怖', '暴れ']) ? 70 : 26
  const fatigueSignal = durationSec >= 20 * 60 ? 68 : durationSec >= 10 * 60 ? 45 : 24

  const gaitRisk = toRiskLevel(gaitSignal)
  const skinRisk = toRiskLevel(skinSignal)
  const tremorRisk = toRiskLevel(tremorSignal)
  const respirationRisk = toRiskLevel(respirationSignal)
  const stressLevel = toRiskLevel(stressSignal)
  const fatigueLevel = toRiskLevel(fatigueSignal)

  const alerts: string[] = []
  if (gaitRisk === 'high') alerts.push('歩行の違和感')
  if (skinRisk !== 'low') alerts.push('皮膚コンディション')
  if (tremorRisk === 'high') alerts.push('震えの兆候')
  if (respirationRisk === 'high') alerts.push('呼吸変化')
  if (alerts.length === 0) alerts.push('大きな異常サインは検出されませんでした')

  const confidenceBase = input.aiPlanCode === 'pro_plus' ? 0.92 : 0.84
  const confidenceNoise = (stressSignal + skinSignal + tremorSignal + respirationSignal) / 4000

  return {
    gaitRisk,
    skinRisk,
    tremorRisk,
    respirationRisk,
    stressLevel,
    fatigueLevel,
    summary: `AI Pro+注意: ${alerts.join(' / ')}`,
    confidence: Number(clamp01(confidenceBase - confidenceNoise).toFixed(2)),
  }
}

export function buildAiProPlusHighlightPath(params: {
  storeId: string
  medicalRecordId: string
  sourcePath: string
}) {
  const extRaw = params.sourcePath.split('.').pop()?.toLowerCase() ?? 'mp4'
  const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'mp4'
  return `${params.storeId}/medical-records/${params.medicalRecordId}/ai-pro-plus-highlight/${Date.now()}-${crypto.randomUUID()}.${ext}`
}

