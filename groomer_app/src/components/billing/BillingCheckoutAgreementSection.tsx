'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { type AiPlanCode } from '@/lib/billing/pricing'
import { PaymentMethodButtons } from '@/components/billing/PaymentMethodButtons'
import { StorageAddonCheckoutPanel } from '@/components/billing/StorageAddonCheckoutPanel'
import { SetupAssistanceCheckoutButton } from '@/components/billing/SetupAssistanceCheckoutButton'
import {
  BillingLegalAgreementCheckbox,
  BILLING_LEGAL_AGREEMENT_REQUIRED_MESSAGE,
} from '@/components/billing/BillingLegalAgreementCheckbox'

type BillingCheckoutAgreementSectionProps = {
  extraCapacityGb: number
  defaultPlanCode: string
  defaultBillingCycle: string
  hotelOptionEnabled: boolean
  notificationOptionEnabled: boolean
  aiPlanCode: AiPlanCode
  ownerActiveStoreCount: number
}

export function BillingCheckoutAgreementSection({
  extraCapacityGb,
  defaultPlanCode,
  defaultBillingCycle,
  hotelOptionEnabled,
  notificationOptionEnabled,
  aiPlanCode,
  ownerActiveStoreCount,
}: BillingCheckoutAgreementSectionProps) {
  const requireLegalAgreement = process.env.NODE_ENV === 'production'
  const [legalAgreed, setLegalAgreed] = useState(false)
  const [agreementError, setAgreementError] = useState('')

  function handleLegalAgreementRequired() {
    setAgreementError(BILLING_LEGAL_AGREEMENT_REQUIRED_MESSAGE)
  }

  function handleAgreementChange(checked: boolean) {
    setLegalAgreed(checked)
    if (checked) {
      setAgreementError('')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <BillingLegalAgreementCheckbox checked={legalAgreed} onChange={handleAgreementChange} />
        {agreementError ? <p className="mt-2 text-xs text-red-600">{agreementError}</p> : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Storage</p>
          <h2 className="text-lg font-semibold text-gray-900">容量追加の決済</h2>
          <p className="mt-1.5 text-sm text-gray-700">
            容量追加分だけを決済します。現在の追加容量は {extraCapacityGb}GB です。
          </p>
          <div className="mt-4">
            <StorageAddonCheckoutPanel
              legalAgreed={legalAgreed}
              requireLegalAgreement={requireLegalAgreement}
              onLegalAgreementRequired={handleLegalAgreementRequired}
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            使用量や超過時ポリシーの詳細は{' '}
            <Link href="/settings?tab=storage" className="font-semibold text-blue-700 hover:underline">
              容量設定
            </Link>{' '}
            で確認できます。
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Checkout</p>
          <h2 className="text-lg font-semibold text-gray-900">基本料金・オプション料金の決済</h2>
          <p className="mt-1.5 text-sm text-gray-700">基本料金と有効化中オプションの契約決済を開始します。</p>
          <div className="mt-4">
            <PaymentMethodButtons
              defaultPlanCode={defaultPlanCode}
              defaultBillingCycle={defaultBillingCycle}
              hotelOptionEnabled={hotelOptionEnabled}
              notificationOptionEnabled={notificationOptionEnabled}
              aiPlanCode={aiPlanCode}
              ownerActiveStoreCount={ownerActiveStoreCount}
              legalAgreed={legalAgreed}
              requireLegalAgreement={requireLegalAgreement}
              onLegalAgreementRequired={handleLegalAgreementRequired}
            />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">One-time</p>
        <h2 className="text-lg font-semibold text-gray-900">初期設定代行</h2>
        <p className="mt-1.5 text-sm text-gray-700">
          初期設定代行のみを決済します。決済完了後に運営側で設定作業を開始します。
        </p>
        <div className="mt-4">
          <SetupAssistanceCheckoutButton
            legalAgreed={legalAgreed}
            requireLegalAgreement={requireLegalAgreement}
            onLegalAgreementRequired={handleLegalAgreementRequired}
          />
        </div>
      </Card>
    </div>
  )
}
