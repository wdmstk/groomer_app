import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'

type JournalLayoutProps = {
  children: ReactNode
}

export default function JournalLayout({ children }: JournalLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 sm:p-6 sm:pt-24">{children}</main>
    </div>
  )
}
