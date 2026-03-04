import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'

type MedicalRecordsLayoutProps = {
  children: ReactNode
}

export default function MedicalRecordsLayout({ children }: MedicalRecordsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
