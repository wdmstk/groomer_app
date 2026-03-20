import test from 'node:test'
import assert from 'node:assert/strict'
import { renderNextVisitSuggestionLineTemplate } from '../src/lib/notification-templates.ts'

test('renderNextVisitSuggestionLineTemplate fills pet, recommended date, and reason', () => {
  const body = renderNextVisitSuggestionLineTemplate({
    customerName: '山田様',
    petName: 'ココ',
    lastVisitAt: '2026-02-01T10:00:00+09:00',
    recommendedAt: '2026-03-18T10:00:00+09:00',
    recommendationReason: '犬種: トイプードル / 毛量: 多め',
  })

  assert.match(body, /山田様/)
  assert.match(body, /ココ/)
  assert.match(body, /2026\/02\/01/)
  assert.match(body, /2026\/03\/18/)
  assert.match(body, /トイプードル/)
})
