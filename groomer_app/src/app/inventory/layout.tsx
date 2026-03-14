import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { InventoryNav } from '@/components/inventory/InventoryNav'

type InventoryLayoutProps = {
  children: ReactNode
}

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar />
      <main className="flex-1 space-y-4 p-4 pt-20 sm:p-6 sm:pt-24">
        <InventoryNav />
        {children}
      </main>
    </div>
  )
}
