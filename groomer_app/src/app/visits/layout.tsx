import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'

type VisitsLayoutProps = {
  children: ReactNode
}

export default function VisitsLayout({ children }: VisitsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
