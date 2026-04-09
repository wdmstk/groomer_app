'use client'

import Link from 'next/link'

export const BILLING_LEGAL_AGREEMENT_REQUIRED_MESSAGE =
  '決済前に、利用規約・プライバシーポリシー・特定商取引法表記への同意が必要です。'

type BillingLegalAgreementCheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function BillingLegalAgreementCheckbox({
  checked,
  onChange,
  disabled = false,
}: BillingLegalAgreementCheckboxProps) {
  return (
    <label
      className="block rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700"
      data-testid="billing-legal-agreement"
    >
      <span className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4"
          disabled={disabled}
        />
        <span>
          決済を実行すると、
          <Link href="/legal/terms" className="text-blue-700 hover:underline">
            利用規約
          </Link>
          ・
          <Link href="/legal/privacy" className="text-blue-700 hover:underline">
            プライバシーポリシー
          </Link>
          ・
          <Link href="/legal/tokusho" className="text-blue-700 hover:underline">
            特定商取引法に基づく表記
          </Link>
          に同意したものとみなされます。
        </span>
      </span>
    </label>
  )
}
