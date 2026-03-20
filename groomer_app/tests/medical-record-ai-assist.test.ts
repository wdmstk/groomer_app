import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveAssistTags,
  deriveRecordSummary,
  hasAiAssistAccess,
} from '../src/lib/medical-records/ai-assist.ts'

test('hasAiAssistAccess enables assist and higher plans', () => {
  assert.equal(hasAiAssistAccess('none'), false)
  assert.equal(hasAiAssistAccess('assist'), true)
  assert.equal(hasAiAssistAccess('pro'), true)
  assert.equal(hasAiAssistAccess('pro_plus'), true)
})

test('deriveAssistTags builds expected assist tags', () => {
  const tags = deriveAssistTags({
    skinCondition: '皮膚がやや乾燥',
    behaviorNotes: '耳を触ると少し嫌がる',
    menu: 'シャンプーコース',
    photoComments: ['毛玉あり'],
  })
  assert.equal(tags.includes('毛玉'), true)
  assert.equal(tags.includes('皮膚'), true)
  assert.equal(tags.includes('耳汚れ'), true)
  assert.equal(tags.includes('施術内容'), true)
})

test('deriveRecordSummary returns short generated text', () => {
  const text = deriveRecordSummary({
    menu: 'シャンプー',
    duration: 70,
    skinCondition: '乾燥あり',
    behaviorNotes: '落ち着いていた',
    tags: ['毛玉', '皮膚'],
  })
  assert.equal(text.includes('シャンプー'), true)
  assert.equal(text.includes('70分'), true)
  assert.equal(text.includes('AI記録タグ'), true)
})

