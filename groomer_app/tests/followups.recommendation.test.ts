import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRecommendedVisitIntervalDays,
  getRecommendationReason,
  normalizeCoatVolume,
} from '../src/lib/followups/recommendation.ts'

test('normalizeCoatVolume supports japanese labels', () => {
  assert.equal(normalizeCoatVolume('多め'), 'heavy')
  assert.equal(normalizeCoatVolume('少なめ'), 'light')
  assert.equal(normalizeCoatVolume('標準'), 'normal')
})

test('getRecommendedVisitIntervalDays shortens cycle for heavy coat poodles', () => {
  const days = getRecommendedVisitIntervalDays({
    breed: 'トイプードル',
    coatVolume: 'heavy',
  })
  assert.equal(days, 28)
})

test('getRecommendationReason includes breed and interval', () => {
  const reason = getRecommendationReason({
    breed: '柴犬',
    coatVolume: 'light',
    intervalDays: 62,
  })
  assert.match(reason, /柴犬/)
  assert.match(reason, /62日/)
})
