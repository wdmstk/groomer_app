import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMedicalRecordAiTagStatusLabel,
  inferMedicalRecordTags,
  parseMedicalRecordTags,
} from '../src/lib/medical-records/tags.ts'

test('parseMedicalRecordTags trims duplicates', () => {
  assert.deepEqual(parseMedicalRecordTags('毛玉:少, 皮膚状態:正常, 毛玉:少'), [
    '毛玉:少',
    '皮膚状態:正常',
  ])
})

test('inferMedicalRecordTags derives expected labels from record notes', () => {
  const tags = inferMedicalRecordTags({
    skinCondition: '乾燥気味で耳汚れあり',
    behaviorNotes: '涙やけも少し確認',
    cautionNotes: 'もつれあり',
    photoComments: ['施術前に毛玉あり'],
  })

  assert.deepEqual(tags, ['毛玉:中', '皮膚状態:乾燥', '耳汚れ', '涙やけ'])
})

test('getMedicalRecordAiTagStatusLabel returns japanese label', () => {
  assert.equal(getMedicalRecordAiTagStatusLabel('processing'), '解析中')
})
