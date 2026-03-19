import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMedicalRecordTagFilterOptions,
  filterMedicalRecordsByAi,
  getMedicalRecordAiStatusOptions,
  getVisibleMedicalRecordTags,
} from '../src/lib/medical-records/tag-usage.ts'

const records = [
  {
    ai_tag_status: 'completed',
    tags: ['毛玉:中', '皮膚状態:乾燥', '耳汚れ'],
  },
  {
    ai_tag_status: 'failed',
    tags: ['毛玉:多', '皮膚状態:赤み'],
  },
  {
    ai_tag_status: null,
    tags: ['皮膚状態:正常'],
  },
]

test('getVisibleMedicalRecordTags prioritizes attention tags first', () => {
  assert.deepEqual(getVisibleMedicalRecordTags(['耳汚れ', '皮膚状態:乾燥', '毛玉:中', '皮膚状態:正常']), [
    '毛玉:中',
    '皮膚状態:乾燥',
    '耳汚れ',
  ])
})

test('buildMedicalRecordTagFilterOptions returns counts sorted by frequency then priority', () => {
  assert.deepEqual(buildMedicalRecordTagFilterOptions(records), [
    { tag: '毛玉:多', count: 1 },
    { tag: '毛玉:中', count: 1 },
    { tag: '皮膚状態:赤み', count: 1 },
    { tag: '皮膚状態:乾燥', count: 1 },
    { tag: '耳汚れ', count: 1 },
    { tag: '皮膚状態:正常', count: 1 },
  ])
})

test('filterMedicalRecordsByAi narrows list by status and tag', () => {
  assert.equal(
    filterMedicalRecordsByAi(records, {
      status: 'failed',
      tag: '毛玉:多',
    }).length,
    1
  )

  assert.equal(
    filterMedicalRecordsByAi(records, {
      status: 'completed',
      tag: '毛玉:多',
    }).length,
    0
  )
})

test('getMedicalRecordAiStatusOptions includes all bucket and idle fallback', () => {
  assert.deepEqual(getMedicalRecordAiStatusOptions(records), [
    { value: 'all', label: 'すべて', count: 3 },
    { value: 'failed', label: '解析失敗', count: 1 },
    { value: 'queued', label: '解析待ち', count: 0 },
    { value: 'processing', label: '解析中', count: 0 },
    { value: 'completed', label: '解析済み', count: 1 },
    { value: 'idle', label: '未解析', count: 1 },
  ])
})
