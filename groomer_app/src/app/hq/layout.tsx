import { Sidebar } from '@/components/ui/Sidebar'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { redirect } from 'next/navigation'

export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const { supabase, storeId } = await createStoreScopedClient()
  const access = await requireStoreFeatureAccess({
    supabase,
    storeId,
    minimumPlan: 'pro',
  })
  if (!access.ok) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />
      <main className="w-full p-4 pt-20 md:p-6 md:pt-24">{children}</main>
    </div>
  )
}
