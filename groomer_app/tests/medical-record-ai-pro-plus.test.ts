import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveMedicalRecordAiProPlusHealthInsight,
  hasAiProPlusAccess,
} from '../src/lib/medical-records/ai-pro-plus.ts'

test('hasAiProPlusAccess allows pro_plus only', () => {
  assert.equal(hasAiProPlusAccess('none'), false)
  assert.equal(hasAiProPlusAccess('assist'), false)
  assert.equal(hasAiProPlusAccess('pro'), false)
  assert.equal(hasAiProPlusAccess('pro_plus'), true)
})

test('deriveMedicalRecordAiProPlusHealthInsight flags expected health alerts', () => {
  const result = deriveMedicalRecordAiProPlusHealthInsight({
    aiPlanCode: 'pro_plus',
    behaviorNotes: '歩行にふらつきがあり、震えと呼吸の乱れが見られる',
    skinCondition: '皮膚に赤みあり',
    tags: ['皮膚状態:赤み'],
    durationSec: 1300,
  })

  assert.equal(result.gaitRisk, 'high')
  assert.equal(result.skinRisk, 'high')
  assert.equal(result.tremorRisk, 'high')
  assert.equal(result.respirationRisk, 'high')
  assert.equal(result.fatigueLevel !== 'low', true)
  assert.equal(result.summary.includes('AI Pro+注意'), true)
})

