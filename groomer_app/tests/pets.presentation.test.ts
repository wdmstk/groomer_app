import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPetFallback,
  formatPetList,
  formatPetWeight,
  getPetRelatedValue,
  resolvePetQrDisplayUrl,
} from '../src/lib/pets/presentation.ts'

test('pet presentation helpers preserve 0kg and relation fallback', () => {
  assert.equal(formatPetWeight(0), '0 kg')
  assert.equal(formatPetWeight(null), '未登録')
  assert.equal(getPetRelatedValue([{ full_name: '山田 花子' }], 'full_name'), '山田 花子')
  assert.equal(getPetRelatedValue(null, 'full_name' as never), '未登録')
})

test('pet presentation helpers build QR display url from payload and fallback safely', () => {
  const url = resolvePetQrDisplayUrl({
    qr_code_url: 'https://example.com/legacy-qr',
    qr_payload: JSON.stringify({
      customer_name: '山田 花子',
      pet_name: 'こむぎ',
    }),
  })
  assert.match(url ?? '', /customer_name=/)
  assert.match(url ?? '', /pet_name=/)

  assert.equal(
    resolvePetQrDisplayUrl({
      qr_code_url: 'https://example.com/legacy-qr',
      qr_payload: '{broken',
    }),
    'https://example.com/legacy-qr'
  )

  assert.equal(formatPetList(['心臓', 'アレルギー']), '心臓, アレルギー')
  assert.equal(formatPetList(null), 'なし')
  assert.equal(formatPetFallback(''), '未登録')
})
