import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJournalLineBody } from '../src/lib/cron/services/journal-line-notifications-core.ts'

test('buildJournalLineBody includes customer, pet names, and comment', () => {
  const text = buildJournalLineBody({
    customerName: '山田 花子',
    petNames: ['モコ', 'ココ'],
    bodyText: '本日も元気に過ごしています。',
  })

  assert.equal(text.includes('山田 花子様'), true)
  assert.equal(text.includes('モコ・ココちゃん'), true)
  assert.equal(text.includes('本日も元気に過ごしています。'), true)
})

test('buildJournalLineBody falls back when comment is empty', () => {
  const text = buildJournalLineBody({
    customerName: 'お客様',
    petNames: [],
    bodyText: '   ',
  })

  assert.equal(text.includes('ペットの最新日誌をお届けします。'), true)
  assert.equal(text.includes('本日のご様子を日誌に記録しました。'), true)
})
