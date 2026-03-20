import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveMedicalRecordAiProInsight, hasAiProAccess } from '../src/lib/medical-records/ai-pro.ts'

test('hasAiProAccess allows pro tiers only', () => {
  assert.equal(hasAiProAccess('none'), false)
  assert.equal(hasAiProAccess('assist'), false)
  assert.equal(hasAiProAccess('pro'), true)
  assert.equal(hasAiProAccess('pro_plus'), true)
})

test('deriveMedicalRecordAiProInsight returns deterministic pro suggestion', () => {
  const result = deriveMedicalRecordAiProInsight({
    aiPlanCode: 'pro',
    durationMin: 90,
    behaviorNotes: '怖がって暴れやすい。ドライヤーの音に反応あり。',
    skinCondition: '赤みあり',
    tags: ['毛玉:多', '皮膚状態:赤み'],
    videoCount: 2,
  })

  assert.equal(result.modelTier, 'pro')
  assert.equal(result.estimatedNextDurationMin !== null && result.estimatedNextDurationMin >= 90, true)
  assert.equal(result.mattingRisk, 'high')
  assert.equal(result.surchargeRisk, 'high')
  assert.equal(result.personalityTraits.includes('怖がり'), true)
  assert.equal(result.personalityTraits.includes('暴れやすい'), true)
  assert.equal(result.highlightedScenes.some((scene) => scene.type === 'skin_check'), true)
})

test('deriveMedicalRecordAiProInsight upgrades confidence profile on pro_plus', () => {
  const pro = deriveMedicalRecordAiProInsight({
    aiPlanCode: 'pro',
    durationMin: 60,
    behaviorNotes: '落ち着いて協力的',
    skinCondition: null,
    tags: ['毛玉:中'],
    videoCount: 1,
  })
  const proPlus = deriveMedicalRecordAiProInsight({
    aiPlanCode: 'pro_plus',
    durationMin: 60,
    behaviorNotes: '落ち着いて協力的',
    skinCondition: null,
    tags: ['毛玉:中'],
    videoCount: 1,
  })

  assert.equal(proPlus.modelTier, 'pro_plus')
  assert.equal(proPlus.confidence >= pro.confidence, true)
})
