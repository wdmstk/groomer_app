import { notFound } from 'next/navigation'
import { MemberPortalReissueRequestButton } from '@/components/member-portal/MemberPortalReissueRequestButton'

export default function MemberPortalReissueE2EPage() {
  if (process.env.PLAYWRIGHT_E2E !== '1') {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">会員証再発行リクエスト（E2E）</h1>
        <MemberPortalReissueRequestButton token="e2e-token" />
      </div>
    </main>
  )
}
