import { notFound } from 'next/navigation'
import { MemberPortalWaitlistCard } from '@/components/member-portal/MemberPortalWaitlistCard'

export default function MemberPortalWaitlistE2EPage() {
  if (process.env.PLAYWRIGHT_E2E !== '1') {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl">
        <MemberPortalWaitlistCard token="e2e-token" />
      </div>
    </main>
  )
}
