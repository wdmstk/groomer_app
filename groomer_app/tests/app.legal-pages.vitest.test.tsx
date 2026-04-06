import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PrivacyPolicyPage from '../src/app/legal/privacy/page'
import SecurityPolicyPage from '../src/app/legal/security/page'
import TermsPage from '../src/app/legal/terms/page'
import TokushoPage from '../src/app/legal/tokusho/page'
import { LEGAL_NOTICE } from '../src/app/legal/legal-notice'

describe('legal pages', () => {
  it('renders privacy policy title and legal notice values', () => {
    render(<PrivacyPolicyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeTruthy()
    expect(screen.getByText(new RegExp(LEGAL_NOTICE.operatorName))).toBeTruthy()
    expect(screen.getByText(new RegExp(LEGAL_NOTICE.serviceName))).toBeTruthy()
    expect(screen.getAllByText(new RegExp(LEGAL_NOTICE.contactEmail)).length).toBeGreaterThan(0)
  })

  it('renders terms title and contact section', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { level: 1, name: '利用規約' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '13. お問い合わせ' })).toBeTruthy()
    expect(screen.getByText(new RegExp(LEGAL_NOTICE.contactEmail))).toBeTruthy()
  })

  it('renders security page title and security contact', () => {
    render(<SecurityPolicyPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'セキュリティ説明書（企業向け）' }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '10. お問い合わせ窓口' })).toBeTruthy()
    expect(screen.getByText(new RegExp(LEGAL_NOTICE.contactEmail))).toBeTruthy()
  })

  it('renders tokusho page title and pricing section', () => {
    render(<TokushoPage />)

    expect(screen.getByRole('heading', { level: 1, name: '特定商取引法に基づく表記' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '販売価格' })).toBeTruthy()
    expect(screen.getByText('ライト: 月額 2,480円 / 年額 25,296円')).toBeTruthy()
  })
})
