import type { ReactNode } from 'react'
import { DevSidebar } from '@/components/dev/DevSidebar'

type DevLayoutProps = {
  children: ReactNode
}

export default function DevLayout({ children }: DevLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <DevSidebar />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
