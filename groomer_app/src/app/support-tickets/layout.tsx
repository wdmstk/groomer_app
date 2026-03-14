import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'

type SupportTicketsLayoutProps = {
  children: ReactNode
}

export default function SupportTicketsLayout({ children }: SupportTicketsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 sm:p-6 sm:pt-24">{children}</main>
    </div>
  )
}
