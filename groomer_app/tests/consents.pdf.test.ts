import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSimpleConsentPdf } from '../src/lib/consents/pdf.ts'

test('buildSimpleConsentPdf returns a valid PDF-like buffer', () => {
  const buffer = buildSimpleConsentPdf({
    title: 'Consent',
    lines: ['Signer: Taro', 'Note: (escaped) text'],
  })

  const content = buffer.toString('utf8')
  assert.match(content, /^%PDF-1\.4/)
  assert.match(content, /startxref/)
  assert.match(content, /%%EOF$/)
  assert.equal(content.includes('Note: \\(escaped\\) text'), true)
})

test('buildSimpleConsentPdf supports japanese text stream', () => {
  const buffer = buildSimpleConsentPdf({
    title: '同意書',
    lines: ['署名者: 山田 太郎'],
  })

  const content = buffer.toString('utf8')
  assert.match(content, /^%PDF-1\.4/)
  assert.match(content, /HeiseiKakuGo-W5/)
  assert.match(content, /%%EOF$/)
})
